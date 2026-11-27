import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MAX_JOB_ATTEMPTS,
  SEASON,
  STALE_JOB_MS,
  type AdminLogInput,
  type ClaimedJob,
  type JobRow,
  type Repo,
} from "./repo";
import { pickSeed } from "./seed";
import type {
  AdminActionDto,
  AiComment,
  ArenaData,
  Entrant,
  FeedEvent,
  JudgeScore,
  Mission,
  StatusEvent,
  Submission,
  SubmissionStatus,
} from "@ncareers/shared";

/**
 * 파일 백엔드 — DATABASE_URL 이 없을 때 쓴다.
 *
 * 한 프로세스를 전제로 한다. 쓰기는 직렬화하고 임시 파일 → rename 으로 교체해
 * 읽는 쪽이 잘린 JSON 을 보지 않게 한다. 그래도 프로세스가 둘이면 서로를
 * 덮어쓰므로, 워커를 따로 띄울 거라면 Postgres 를 써야 한다.
 */
const DATA_DIR = process.env.ARENA_DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "arena.json");

interface FileShape extends ArenaData {
  jobs?: {
    id: number;
    kind: "evaluate";
    submissionId: string;
    status: "queued" | "running" | "done" | "failed";
    attempts: number;
    lastError?: string;
    /** running 으로 바뀐 시각. 멈춘 작업을 되찾는 데 쓴다. */
    startedAt?: string;
  }[];
  nextJobId?: number;
  adminActions?: AdminActionDto[];
  nextActionId?: number;
}

let memory: FileShape | null = null;
let writable = true;
let chain: Promise<unknown> = Promise.resolve();

async function readFromDisk(): Promise<FileShape | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as FileShape;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (attempt === 0) continue; // 교체 중에 읽었을 수 있다
      console.warn("[repo:file] 저장 파일을 읽지 못해 시드로 다시 시작합니다:", err);
      return null;
    }
  }
  return null;
}

async function load(): Promise<FileShape> {
  if (memory) return memory;
  const disk = await readFromDisk();
  memory = disk ?? { ...pickSeed(), jobs: [], adminActions: [], nextJobId: 1, nextActionId: 1 };
  memory.jobs ??= [];
  memory.adminActions ??= [];
  memory.nextJobId ??= 1;
  memory.nextActionId ??= 1;
  if (!disk) await persist(memory);
  return memory;
}

async function persist(data: FileShape): Promise<void> {
  if (!writable) return;
  const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    writable = false;
    console.warn("[repo:file] 파일에 쓸 수 없어 메모리 모드로 전환합니다:", err);
  }
}

/** 쓰기를 직렬화한다 */
function write<T>(fn: (data: FileShape) => T): Promise<T> {
  const run = chain.then(async () => {
    const data = await load();
    const result = fn(data);
    await persist(data);
    return result;
  });
  chain = run.catch(() => undefined);
  return run;
}

function findSub(data: FileShape, id: string): Submission | undefined {
  return data.submissions.find((s) => s.id === id);
}

export const fileRepo: Repo = {
  backend: "file",

  async read(): Promise<ArenaData> {
    const d = await load();
    // 깊은 복사. 얕게 주면 호출한 쪽이 고친 게 저장소 안까지 들어가,
    // 쓰기 함수가 기록한 것과 겹쳐 두 번 쌓인다.
    return {
      season: SEASON,
      entrants: structuredClone(d.entrants),
      missions: structuredClone(d.missions),
      submissions: structuredClone(d.submissions),
      comments: structuredClone(d.comments),
      feed: structuredClone(d.feed),
    };
  },

  createEntrant: (e: Entrant) => write((d) => void d.entrants.push(e)),
  createMission: (m: Mission) => write((d) => void d.missions.push(m)),
  createSubmission: (s: Submission) => write((d) => void d.submissions.push(s)),
  createComment: (c: AiComment) => write((d) => void d.comments.push(c)),

  advanceStatus: (submissionId: string, status: SubmissionStatus, event: StatusEvent) =>
    write((d) => {
      const sub = findSub(d, submissionId);
      if (!sub) return;
      sub.status = status;
      sub.updatedAt = event.at;
      sub.statusHistory.push(event);
    }),

  putJudgeScore: (submissionId: string, score: JudgeScore) =>
    write((d) => {
      const sub = findSub(d, submissionId);
      if (!sub) return;
      sub.judgeScores = sub.judgeScores.filter((s) => s.judgeId !== score.judgeId);
      sub.judgeScores.push(score);
      sub.updatedAt = new Date().toISOString();
    }),

  setComposite: (submissionId: string, composite: number | null) =>
    write((d) => {
      const sub = findSub(d, submissionId);
      if (!sub) return;
      sub.composite = composite;
      sub.updatedAt = new Date().toISOString();
    }),

  pushEvent: (event: Omit<FeedEvent, "id" | "at">) =>
    write((d) => {
      const ev: FeedEvent = {
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        ...event,
      };
      d.feed.unshift(ev);
      d.feed = d.feed.slice(0, 120);
    }),

  enqueueEvaluation: (submissionId: string) =>
    write((d) => {
      const id = d.nextJobId ?? 1;
      d.nextJobId = id + 1;
      d.jobs!.push({ id, kind: "evaluate", submissionId, status: "queued", attempts: 0 });
    }),

  claimJob: (): Promise<ClaimedJob | null> =>
    write((d) => {
      const staleBefore = Date.now() - STALE_JOB_MS;
      const job = d.jobs!.find(
        (j) =>
          j.status === "queued" ||
          // 워커가 작업 중에 죽으면 running 으로 남는다. 일정 시간이 지나면 되찾는다.
          (j.status === "running" && new Date(j.startedAt ?? 0).getTime() < staleBefore),
      );
      if (!job) return null;
      job.status = "running";
      job.startedAt = new Date().toISOString();
      job.attempts += 1;
      return { id: job.id, kind: job.kind, submissionId: job.submissionId, attempts: job.attempts };
    }),

  finishJob: (id: number, error?: string) =>
    write((d) => {
      const job = d.jobs!.find((j) => j.id === id);
      if (!job) return;
      if (!error) {
        job.status = "done";
        delete job.lastError;
        return;
      }
      job.lastError = error;
      job.status = job.attempts >= MAX_JOB_ATTEMPTS ? "failed" : "queued";
    }),

  /* ───────────── 어드민 ───────────── */

  updateMission: (id: string, patch: Partial<Mission>) =>
    write((d) => {
      const i = d.missions.findIndex((m) => m.id === id);
      if (i < 0) return;
      // undefined 가 들어오면 기존 값을 지우므로, 들어온 키만 덮어쓴다.
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      d.missions[i] = { ...d.missions[i]!, ...defined };
    }),

  deleteMission: (id: string) =>
    write((d) => {
      d.missions = d.missions.filter((m) => m.id !== id);
    }),

  setSubmissionHidden: (id: string, hidden: boolean, reason?: string) =>
    write((d) => {
      const sub = findSub(d, id);
      if (!sub) return;
      sub.hidden = hidden;
      if (hidden) sub.hiddenReason = reason;
      else delete sub.hiddenReason;
      sub.updatedAt = new Date().toISOString();
    }),

  deleteSubmission: (id: string) =>
    write((d) => {
      d.submissions = d.submissions.filter((s) => s.id !== id);
      d.comments = d.comments.filter((c) => c.submissionId !== id);
      for (const j of d.jobs!) {
        if (j.submissionId === id && (j.status === "queued" || j.status === "running")) {
          j.status = "done";
        }
      }
    }),

  deleteComment: (id: string) =>
    write((d) => {
      d.comments = d.comments.filter((c) => c.id !== id);
    }),

  logAdminAction: (entry: AdminLogInput) =>
    write((d) => {
      const id = d.nextActionId ?? 1;
      d.nextActionId = id + 1;
      d.adminActions!.unshift({ id, ...entry, at: new Date().toISOString() });
      d.adminActions = d.adminActions!.slice(0, 200);
    }),

  listAdminActions: (limit: number) =>
    write((d) => structuredClone(d.adminActions!.slice(0, limit))),

  listJobs: (limit: number): Promise<JobRow[]> =>
    write((d) =>
      [...d.jobs!]
        .reverse()
        .slice(0, limit)
        .map((j) => ({
          id: j.id,
          submissionId: j.submissionId,
          status: j.status,
          attempts: j.attempts,
          lastError: j.lastError,
          runAfter: j.startedAt ?? "",
          updatedAt: j.startedAt ?? "",
        })),
    ),
};
