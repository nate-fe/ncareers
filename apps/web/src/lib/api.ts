import type {
  EventsPayload,
  HomePayload,
  JudgesPayload,
  LeaderboardPayload,
  MissionsPayload,
  RankingPayload,
  RosterPayload,
  SubmissionDetailPayload,
} from "@ncareers/shared";

/**
 * BE 로 가는 유일한 창구.
 *
 * 화면은 DB·큐·메일·LLM 을 모른다. 아는 건 주소 하나뿐이고, 그 주소는
 * NEXT_PUBLIC_API_URL 로 바깥에서 정해진다. 그래서 BE 를 Railway 에 두든
 * 나중에 산 도메인의 api 서브도메인으로 옮기든 FE 는 환경변수만 바뀐다.
 *
 * 브라우저도 이 주소를 그대로 쓴다 (순위 30초 폴링). 그래서 NEXT_PUBLIC_ 이다.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  "",
);

export const apiUrl = (path: string) => `${API_BASE}${path}`;

/**
 * 이 화면 자신의 주소.
 *
 * MCP 서버와 스킬 파일은 FE 가 정적으로 들고 있어서(`public/`), 내려받는 주소는
 * API 주소가 아니라 이쪽입니다. 안내 문서에 복사해 붙일 수 있는 절대 주소를
 * 찍으려고 둡니다. 도메인을 사면 NEXT_PUBLIC_SITE_URL 만 넣으면 됩니다.
 */
export const SITE_BASE = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * BE 가 꺼져 있을 때 화면 전체가 500 으로 죽지 않게, 호출하는 쪽이 판단할 수
 * 있도록 null 을 돌려주는 변형을 따로 둔다. 서버 렌더에서 이걸 쓴다.
 */
async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { cache: "no-store" });
  } catch (err) {
    throw new ApiError(0, `BE(${API_BASE}) 에 연결하지 못했습니다: ${String(err)}`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await get<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    console.error("[web→api]", err);
    return null;
  }
}

export const api = {
  home: () => getOrNull<HomePayload>("/api/v1/home"),
  ranking: () => getOrNull<RankingPayload>("/api/v1/ranking"),
  leaderboard: () => getOrNull<LeaderboardPayload>("/api/v1/leaderboard"),
  events: (limit = 30) => getOrNull<EventsPayload>(`/api/v1/events?limit=${limit}`),
  missions: () => getOrNull<MissionsPayload>("/api/v1/missions"),
  roster: () => getOrNull<RosterPayload>("/api/v1/roster"),
  judges: () => getOrNull<JudgesPayload>("/api/v1/judges"),
  submission: (id: string) =>
    getOrNull<SubmissionDetailPayload>(`/api/v1/submissions/${encodeURIComponent(id)}`),
};

/** BE 가 아예 응답하지 않을 때 화면이 쓰는 빈 순위. */
export const EMPTY_LEADERBOARD: LeaderboardPayload = {
  updatedAt: new Date(0).toISOString(),
  reward: "상위 랭킹 출품작은 ncareers 메인 화면에 노출됩니다.",
  pendingCount: 0,
  ranking: [],
};
