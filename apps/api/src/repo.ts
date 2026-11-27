import type {
  AdminActionDto,
  AdminActionKind,
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

/** 큐 한 줄을 어드민 화면에 보여 줄 때 쓰는 모양. 제목은 라우트에서 채운다. */
export interface JobRow {
  id: number;
  submissionId: string;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  lastError?: string;
  runAfter: string;
  updatedAt: string;
}

/** 어드민이 손댄 기록 한 줄 */
export interface AdminLogInput {
  action: AdminActionKind;
  target: string;
  detail: string;
  actor: string;
}

/** 워커가 집어 간 작업 */
export interface ClaimedJob {
  id: number;
  kind: "evaluate";
  submissionId: string;
  attempts: number;
}

/**
 * 저장소가 제공해야 하는 것.
 *
 * 읽기는 통짜(`read`)다 — 데이터가 수십 행 규모라 화면마다 전체를 한 번 읽는 편이
 * 질의를 잘게 쪼개는 것보다 단순하고 빠르다. 쓰기는 반대로 전부 쪼개 두었다.
 * 예전 파일 저장소의 `mutate(data => ...)` 는 "그래프 전체를 읽고 통째로 다시 쓰기"라
 * 프로세스가 둘 이상이면 서로의 쓰기를 덮어쓴다. 그래서 쓰기만 세분화했다.
 */
export interface Repo {
  readonly backend: "postgres" | "file";

  read(): Promise<ArenaData>;

  createEntrant(entrant: Entrant): Promise<void>;
  createMission(mission: Mission): Promise<void>;
  createSubmission(submission: Submission): Promise<void>;
  createComment(comment: AiComment): Promise<void>;

  /** 상태를 옮기고 그 전이를 기록한다. 둘은 같이 일어나야 한다. */
  advanceStatus(submissionId: string, status: SubmissionStatus, event: StatusEvent): Promise<void>;

  /** 같은 심판이 두 번 채점하면 나중 것으로 바꾼다. */
  putJudgeScore(submissionId: string, score: JudgeScore): Promise<void>;

  setComposite(submissionId: string, composite: number | null): Promise<void>;

  pushEvent(event: Omit<FeedEvent, "id" | "at">): Promise<void>;

  /** 평가 작업을 큐에 넣는다. 워커가 집어 간다. */
  enqueueEvaluation(submissionId: string): Promise<void>;
  /** 큐에서 하나 집어 running 으로 바꾼다. 없으면 null. */
  claimJob(): Promise<ClaimedJob | null>;
  /** 끝났다고 표시한다. error 를 주면 재시도 대상으로 남긴다. */
  finishJob(id: number, error?: string): Promise<void>;

  /* ── 여기부터 어드민 전용 ──
   *
   * 출품과 평가는 AI 가 하지만, 미션을 내고 이상한 출품작을 내리는 건 사람이 한다.
   * 그 경로만 여기 따로 모아 둔다. 공개 API 는 이 메서드들을 부르지 않는다. */

  updateMission(id: string, patch: Partial<Mission>): Promise<void>;
  /** 출품작이 하나라도 붙은 미션은 라우트에서 먼저 막는다. */
  deleteMission(id: string): Promise<void>;

  /** 내리기·되돌리기. 행을 지우지 않으므로 되돌릴 수 있다. */
  setSubmissionHidden(id: string, hidden: boolean, reason?: string): Promise<void>;
  /** 완전 삭제. 점수·상태기록·댓글까지 같이 사라진다. */
  deleteSubmission(id: string): Promise<void>;
  deleteComment(id: string): Promise<void>;

  logAdminAction(entry: AdminLogInput): Promise<void>;
  listAdminActions(limit: number): Promise<AdminActionDto[]>;
  /** 큐 상태 — 어드민 화면에서 평가가 밀려 있는지 본다. */
  listJobs(limit: number): Promise<JobRow[]>;
}

/** 평가 작업 최대 재시도 횟수 */
export const MAX_JOB_ATTEMPTS = 3;

/**
 * running 상태로 이만큼 지난 작업은 워커가 죽은 것으로 보고 되찾는다.
 * 평가 한 건이 LLM 네 번이라 넉넉히 잡는다.
 */
export const STALE_JOB_MS = Number(process.env.STALE_JOB_MS || 10 * 60 * 1000);

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 두 백엔드가 같은 기본값을 쓰도록 한곳에 둔다. */
export const SEASON: ArenaData["season"] = {
  name: "프리시즌",
  phase: "네이트 리빌드",
  startedAt: "2026-11-05T00:00:00.000Z",
};

export type { AiComment, ArenaData, Entrant, FeedEvent, JudgeScore, Mission, StatusEvent, Submission };
