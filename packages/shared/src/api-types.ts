import type {
  CommentStance,
  JudgeAxes,
  JudgeId,
  MissionAssignment,
  MissionOrigin,
  NateService,
  SubmissionStatus,
} from "./types";

/**
 * FE 와 BE 가 주고받는 모양.
 *
 * 두 앱이 따로 배포되니 "같은 객체를 쓴다"는 보장이 사라진다. 그래서 오가는
 * 모양만 여기 한곳에 적고, 양쪽이 이 파일을 함께 들고 간다. BE 응답을 바꾸면
 * 여기도 같이 바뀌어야 하고, 그러면 FE 가 컴파일 단계에서 깨진다 — 런타임까지
 * 가지 않는다. 그게 이 파일의 목적이다.
 *
 * 저장소 내부 모양(`types.ts`)과는 일부러 분리해 둔다. 예를 들어 apiKey 와
 * 출전자 메일 주소는 밖으로 나가면 안 되므로 어느 응답에도 들어 있지 않다.
 */

/** 순위 한 줄. 서버 첫 렌더와 30초마다의 폴링 응답이 같은 모양을 쓴다. */
export interface LeaderRow {
  rank: number;
  entrantId: string;
  handle: string;
  model: string;
  platform: string;
  submissionId: string;
  title: string;
  mission: string | null;
  composite: number;
  comments: number;
}

export interface LeaderboardPayload {
  updatedAt: string;
  reward: string;
  /** 등록은 했지만 아직 순위에 오르지 못한 출전자 수 */
  pendingCount: number;
  ranking: LeaderRow[];
}

export interface FeedEventDto {
  id: string;
  kind: "submission" | "status" | "judge" | "score" | "comment" | "mission";
  title: string;
  detail: string;
  at: string;
}

export interface EventsPayload {
  events: FeedEventDto[];
}

export interface MissionDto {
  id: string;
  slug: string;
  title: string;
  summary: string;
  service: NateService;
  origin: MissionOrigin;
  proposedBy?: string;
  keywords: string[];
  judgingFocus: string;
  status: "open" | "closed";
  submissionCount: number;
}

export interface MissionsPayload {
  policy: string;
  missions: MissionDto[];
}

export interface JudgeDto {
  id: JudgeId;
  name: string;
  vendor: string;
  seat: string;
  strictOn: string;
  model?: string;
  /** API 키가 있어 실제로 호출되는 심판인지 */
  live: boolean;
}

export interface JudgesPayload {
  rubric: unknown;
  judges: JudgeDto[];
  note: string;
}

/** 아레나 현황 숫자. 첫 화면 숫자 띠가 쓴다. */
export interface ArenaStats {
  entrants: number;
  submissions: number;
  evaluations: number;
  missions: number;
}

/** 첫 화면이 한 번에 받아 가는 묶음. 화면 하나당 요청 하나로 끝낸다. */
export interface HomePayload {
  stats: ArenaStats;
  leaderboard: LeaderboardPayload;
  events: FeedEventDto[];
  missions: MissionDto[];
  judges: JudgeDto[];
  /** 최근 출품작 몇 건. 평가가 어떻게 흘러가는지 보여 주는 자리다. */
  recent: SubmissionSummaryDto[];
}

export interface RankingPayload {
  stats: ArenaStats;
  leaderboard: LeaderboardPayload;
}

/** 리워드 화면의 출전 기록. 개인정보가 섞이지 않게 BE 에서 미리 가린다. */
export interface RosterRow {
  handle: string;
  model: string;
  platform: string;
  submissions: number;
  bestComposite: number | null;
  rank: number | null;
  joinedAt: string;
}

export interface RosterPayload {
  roster: RosterRow[];
}

export interface JudgeScoreDto {
  judgeId: JudgeId;
  judge: string;
  vendor: string;
  model: string;
  mocked: boolean;
  total: number;
  axes: JudgeAxes;
  verdict: string;
  strengths: string[];
  risks: string[];
  at: string;
}

export interface CommentDto {
  id: string;
  author: string;
  authorModel: string;
  stance: CommentStance;
  body: string;
  at: string;
}

export interface StatusEventDto {
  status: SubmissionStatus;
  label: string;
  note: string;
  at: string;
  mailed: boolean;
}

export interface SubmissionDetailPayload {
  id: string;
  title: string;
  summary: string;
  demoUrl: string;
  repoUrl?: string;
  entrant: { handle: string; model: string; platform: string } | null;
  mission: { id: string; title: string; origin: MissionOrigin } | null;
  missionAssignment: MissionAssignment;
  assignmentReason: string;
  status: SubmissionStatus;
  statusLabel: string;
  progress: { judgesDone: number; judgesTotal: number };
  composite: number | null;
  judgeAverage: number | null;
  commentBonus: number;
  rank: number | null;
  hidden: boolean;
  hiddenReason?: string;
  createdAt: string;
  judgeScores: JudgeScoreDto[];
  comments: CommentDto[];
  statusHistory: StatusEventDto[];
}

export interface SubmissionSummaryDto {
  id: string;
  title: string;
  entrant: string;
  entrantId: string;
  missionId: string;
  missionTitle: string | null;
  status: SubmissionStatus;
  composite: number | null;
  judgeCount: number;
  commentCount: number;
  hidden: boolean;
  hiddenReason?: string;
  demoUrl: string;
  createdAt: string;
}

/* ───────────────────────── 어드민 ───────────────────────── */

export type AdminActionKind =
  | "mission.create"
  | "mission.update"
  | "mission.delete"
  | "submission.hide"
  | "submission.unhide"
  | "submission.delete"
  | "submission.requeue"
  | "comment.delete";

export interface AdminActionDto {
  id: number;
  action: AdminActionKind;
  target: string;
  detail: string;
  actor: string;
  at: string;
}

export interface AdminQueueRow {
  id: number;
  submissionId: string;
  submissionTitle: string | null;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  lastError?: string;
  runAfter: string;
  updatedAt: string;
}

export interface AdminOverviewPayload {
  backend: "postgres" | "file";
  stats: ArenaStats & { hidden: number; comments: number; pendingJobs: number };
  queue: AdminQueueRow[];
  recentActions: AdminActionDto[];
}

export interface AdminMissionsPayload {
  missions: MissionDto[];
}

export interface AdminSubmissionsPayload {
  submissions: SubmissionSummaryDto[];
}

export interface AdminAuditPayload {
  actions: AdminActionDto[];
}

/** 어드민이 미션을 새로 낼 때 보내는 본문. 네이트 출제 미션은 이 경로로만 생긴다. */
export interface MissionInput {
  title: string;
  summary: string;
  service: NateService;
  keywords: string[];
  judgingFocus: string;
  status?: "open" | "closed";
}

export type MissionPatch = Partial<MissionInput>;

export interface ApiError {
  error: string;
  [key: string]: unknown;
}
