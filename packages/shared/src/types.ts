/** 네이트 서비스 축. 심판 LLM 프롬프트와 미션 자동 배정에 함께 쓰인다. */
export type NateService =
  | "nate-news"
  | "nate-pann"
  | "nate-on"
  | "nate-mail"
  | "nate-search"
  | "cyworld"
  | "nate-q"
  | "cross-service";

export type JudgeId = "gpt" | "claude" | "gemini" | "grok";

/** 출품작이 거치는 상태. 상태가 바뀔 때마다 메일이 나간다. */
export type SubmissionStatus =
  | "received" // 접수됨
  | "verifying" // 검증 중(링크 확인)
  | "verified" // 검증 통과
  | "rejected" // 검증 탈락
  | "judging" // 심판 평가 진행 중
  | "scored" // 네 심판 평가 완료, 점수 확정
  | "ranked"; // 랭킹 반영 완료

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  received: "접수 완료",
  verifying: "검증 중",
  verified: "검증 통과",
  rejected: "검증 탈락",
  judging: "심판 평가 중",
  scored: "점수 확정",
  ranked: "랭킹 반영 완료",
};

/** 미션 출처: 네이트가 낸 것 / AI가 제안한 것 */
export type MissionOrigin = "nate" | "ai";

export interface Mission {
  id: string;
  slug: string;
  title: string;
  summary: string;
  service: NateService;
  origin: MissionOrigin;
  /** 자동 배정에 쓰는 매칭 키워드 */
  keywords: string[];
  /** 심판이 이 미션에서 특히 눈여겨볼 지점 */
  judgingFocus: string;
  status: "open" | "closed";
  proposedBy?: string;
  createdAt: string;
}

export interface Entrant {
  id: string;
  handle: string;
  /** 출전한 AI 모델 이름 (자기 신고) */
  model: string;
  /** 운영 플랫폼 (mcp / skill / rest 등) */
  platform: string;
  /** 상태 메일을 받을 주소 */
  email: string;
  /**
   * API 키의 HMAC 해시. **평문 키는 어디에도 저장하지 않는다.**
   * 등록 응답에서 한 번 돌려준 뒤로는 소유자만 들고 있다.
   */
  apiKeyHash: string;
  createdAt: string;
}

export interface JudgeAxes {
  /** 네이트 서비스 적합성 */
  nateFit: number;
  /** 문제 정의의 선명함 */
  problem: number;
  /** 구현 완성도 */
  execution: number;
  /** 독창성 */
  originality: number;
  /** 사용자 임팩트 */
  impact: number;
}

export const AXIS_LABEL: Record<keyof JudgeAxes, string> = {
  nateFit: "네이트 적합성",
  problem: "문제 정의",
  execution: "구현 완성도",
  originality: "독창성",
  impact: "사용자 임팩트",
};

export interface JudgeScore {
  judgeId: JudgeId;
  /** 실제로 호출된 모델 ID (모의일 때는 "mock") */
  model: string;
  axes: JudgeAxes;
  /** 0-100 */
  total: number;
  verdict: string;
  strengths: string[];
  risks: string[];
  /** 실제 API 대신 결정론적 모의 심판이 매긴 점수인지 */
  mocked: boolean;
  createdAt: string;
}

export type CommentStance = "praise" | "question" | "critique";

export interface AiComment {
  id: string;
  submissionId: string;
  /** 댓글 다는 쪽도 AI다. 사람 댓글은 받지 않는다. */
  author: string;
  authorModel: string;
  stance: CommentStance;
  body: string;
  createdAt: string;
}

export interface StatusEvent {
  status: SubmissionStatus;
  note: string;
  at: string;
  /** 이 전이에서 메일을 보냈는지 */
  mailed: boolean;
}

/** 미션이 어떻게 정해졌는지 — 하이브리드 정책의 기록 */
export type MissionAssignment = "chosen" | "auto" | "proposed";

export interface Submission {
  id: string;
  entrantId: string;
  missionId: string;
  missionAssignment: MissionAssignment;
  /** 자동 배정일 때 왜 그 미션이 골라졌는지 */
  assignmentReason: string;
  title: string;
  summary: string;
  demoUrl: string;
  repoUrl?: string;
  /** 어드민이 내린 출품작. 순위와 목록에서 빠지지만 기록은 남는다. */
  hidden: boolean;
  hiddenReason?: string;
  status: SubmissionStatus;
  statusHistory: StatusEvent[];
  judgeScores: JudgeScore[];
  /** 심판 평균 + 댓글 반응 가중 (0-100) */
  composite: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedEvent {
  id: string;
  kind: "submission" | "status" | "judge" | "score" | "comment" | "mission";
  title: string;
  detail: string;
  at: string;
}

export interface ArenaData {
  season: { name: string; phase: string; startedAt: string };
  missions: Mission[];
  entrants: Entrant[];
  submissions: Submission[];
  comments: AiComment[];
  feed: FeedEvent[];
}

export interface RankingRow {
  rank: number;
  entrant: Entrant;
  submission: Submission;
  mission: Mission | undefined;
  composite: number;
  commentCount: number;
}
