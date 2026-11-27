import { Hono } from "hono";
import { JUDGES, JUDGE_ORDER } from "@ncareers/shared";
import type { JudgeDto } from "@ncareers/shared";
import { readData } from "../store";
import { judgeStatus } from "../judges";
import { RUBRIC } from "../judges/prompt";
import {
  toFeed,
  toLeaderboardPayload,
  toMissionDtos,
  toRoster,
  toStats,
  toSubmissionDetail,
  toSubmissionSummaries,
} from "../live";

/**
 * 누구나 볼 수 있는 조회 경로. 토큰이 필요 없다.
 *
 * 화면 하나당 요청 하나로 끝나게 묶어서 준다 (`/home`, `/ranking`). 폴링 경로
 * (`/leaderboard`, `/events`)는 따로 두는데, 30초마다 돌아오는 요청이 미션 목록과
 * 심판 소개까지 매번 끌고 올 이유가 없기 때문이다.
 */
const nocache = { "cache-control": "no-store" } as const;

function judgeDtos(): JudgeDto[] {
  const status = judgeStatus();
  return JUDGE_ORDER.map((id) => {
    const s = status.find((x) => x.id === id);
    return {
      id,
      name: JUDGES[id].name,
      vendor: JUDGES[id].vendor,
      seat: JUDGES[id].seat,
      strictOn: JUDGES[id].strictOn,
      model: s?.model,
      live: s?.live ?? false,
    };
  });
}

export const publicRoutes = new Hono()

  /** 첫 화면이 쓰는 묶음 */
  .get("/home", async (c) => {
    const data = await readData();
    return c.json(
      {
        stats: toStats(data),
        leaderboard: toLeaderboardPayload(data),
        events: toFeed(data, 12),
        missions: toMissionDtos(data),
        judges: judgeDtos(),
        recent: toSubmissionSummaries(data)
          .filter((s) => !s.hidden)
          .slice(0, 3),
      },
      200,
      nocache,
    );
  })

  /** 전체 순위 화면 */
  .get("/ranking", async (c) => {
    const data = await readData();
    return c.json({ stats: toStats(data), leaderboard: toLeaderboardPayload(data) }, 200, nocache);
  })

  /** 30초마다 돌아오는 폴링 대상 */
  .get("/leaderboard", async (c) => {
    const data = await readData();
    return c.json(toLeaderboardPayload(data), 200, nocache);
  })

  .get("/events", async (c) => {
    const raw = Number(c.req.query("limit") ?? 30);
    const limit = Number.isFinite(raw) ? Math.max(1, Math.min(120, Math.trunc(raw))) : 30;
    const data = await readData();
    return c.json({ events: toFeed(data, limit) }, 200, nocache);
  })

  .get("/missions", async (c) => {
    const data = await readData();
    return c.json(
      {
        policy:
          "하이브리드. 출품 시 missionId 를 보내면 그 미션으로 가고, 안 보내면 출품 내용을 보고 서버가 자동 배정합니다.",
        missions: toMissionDtos(data),
      },
      200,
      nocache,
    );
  })

  .get("/roster", async (c) => {
    const data = await readData();
    return c.json({ roster: toRoster(data) }, 200, nocache);
  })

  /** 심판 구성과 채점 규칙은 그대로 공개한다. */
  .get("/judges", (c) =>
    c.json(
      {
        rubric: RUBRIC,
        judges: judgeDtos(),
        note: "live=false 인 심판은 API 키가 없어 결정론적 모의 채점으로 대체됩니다.",
      },
      200,
      nocache,
    ),
  )

  .get("/submissions", async (c) => {
    const data = await readData();
    const byEntrant = new Map(data.entrants.map((e) => [e.id, e]));
    return c.json(
      {
        submissions: data.submissions
          .filter((s) => !s.hidden)
          .map((s) => ({
            id: s.id,
            title: s.title,
            entrant: byEntrant.get(s.entrantId)?.handle ?? "unknown",
            missionId: s.missionId,
            status: s.status,
            composite: s.composite,
            judgeCount: s.judgeScores.length,
            createdAt: s.createdAt,
          })),
      },
      200,
      nocache,
    );
  })

  /**
   * 출품 후 현재 상태를 묻는 창구.
   * 내려간 출품작은 404 로 답한다 — 사라진 것과 구별할 이유가 없다.
   */
  .get("/submissions/:id", async (c) => {
    const data = await readData();
    const detail = toSubmissionDetail(data, c.req.param("id"));
    if (!detail || detail.hidden) {
      return c.json({ error: "출품작을 찾을 수 없습니다." }, 404);
    }
    return c.json(detail, 200, nocache);
  })

  .get("/submissions/:id/comments", async (c) => {
    const id = c.req.param("id");
    const data = await readData();
    return c.json(
      { comments: data.comments.filter((cm) => cm.submissionId === id) },
      200,
      nocache,
    );
  });
