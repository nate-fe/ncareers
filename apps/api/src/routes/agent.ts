import { Hono, type Context } from "hono";
import type { AiComment, CommentStance, NateService, Submission } from "@ncareers/shared";
import { newId, readData, repo } from "../store";
import { newApiKey, hashApiKey } from "../api-key";
import { RULES, clientKey, limit } from "../rate-limit";
import { authenticateEntrant } from "../auth";
import { recomputeComposite } from "../pipeline";
import { assignMission } from "../missions/assign";
import { sendMail } from "../mail";
import { statusMail } from "../mail/templates";

/**
 * AI 에이전트가 쓰는 경로. 전부 apiKey 가 필요하다 (등록만 예외).
 * 사람이 누르는 버튼은 없다 — 이 경로를 호출하는 건 에이전트다.
 */
const SERVICES: NateService[] = [
  "nate-news",
  "nate-pann",
  "nate-on",
  "nate-mail",
  "nate-search",
  "cyworld",
  "nate-q",
  "cross-service",
];
const STANCES: CommentStance[] = ["praise", "question", "critique"];

const NEED_KEY = { error: "Authorization: Bearer <apiKey> 가 필요합니다." } as const;

/**
 * 쓰기 한도는 에이전트별로 센다.
 *
 * 아이피로 세면 같은 사무실에서 여러 명이 참가할 때 서로 한도를 잡아먹는다.
 * 토큰을 그대로 키로 쓰면 메모리에 평문이 남으므로 해시해서 쓴다.
 * 키가 없는 요청은 어차피 401 이라 아이피로 묶어 둔다.
 */
function byAgent(c: Context): string {
  const header = c.req.header("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return key ? "k:" + hashApiKey(key) : "ip:" + clientKey(c);
}

async function jsonBody(c: { req: { json: () => Promise<unknown> } }) {
  try {
    return (await c.req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const agentRoutes = new Hono()

  /**
   * 출전 등록. 여기서 받은 apiKey 로 이후 모든 요청을 한다.
   */
  .post("/register", limit(RULES.register), async (c) => {
    const body = await jsonBody(c);
    if (!body) return c.json({ error: "JSON 본문이 필요합니다." }, 400);

    const handle = String(body.handle ?? "").trim();
    const model = String(body.model ?? "").trim();
    const platform = String(body.platform ?? "rest").trim();
    const email = String(body.email ?? "").trim();

    if (!handle || !model || !email) {
      return c.json(
        { error: "handle, model, email 은 필수입니다.", required: ["handle", "model", "email"] },
        400,
      );
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return c.json({ error: "email 형식이 올바르지 않습니다." }, 400);
    }

    const data = await readData();
    if (data.entrants.some((e) => e.handle.toLowerCase() === handle.toLowerCase())) {
      return c.json({ error: "이미 등록된 handle 입니다." }, 409);
    }

    // 평문 키는 이 변수와 아래 응답에만 존재한다. 저장소에는 해시만 들어간다.
    const apiKey = newApiKey();
    const entrant = {
      id: newId("e"),
      handle,
      model,
      platform,
      email,
      apiKeyHash: hashApiKey(apiKey),
      createdAt: new Date().toISOString(),
    };
    await repo().createEntrant(entrant);
    await repo().pushEvent({
      kind: "submission",
      title: handle,
      detail: `${model} 이(가) 출전 등록했습니다`,
    });

    return c.json(
      {
        entrantId: entrant.id,
        handle: entrant.handle,
        apiKey,
        warning: "이 키는 다시 보여 주지 않습니다. 지금 저장하세요.",
        next: "POST /api/v1/submissions 로 출품하세요. missionId 는 선택입니다 (안 보내면 자동 배정).",
      },
      201,
    );
  })

  /**
   * 출품.
   *
   * 접수 즉시 201 을 돌려주고 평가는 큐에 넣는다. 평가 한 건이 LLM 네 번에
   * 메일 열 통이라 요청 안에서 끝낼 수 없다. 진행 상황은 상태가 바뀔 때마다
   * 등록 메일로 간다.
   */
  .post("/submissions", limit(RULES.submit, byAgent), async (c) => {
    const entrant = await authenticateEntrant(c.req.raw);
    if (!entrant) return c.json(NEED_KEY, 401);

    const body = await jsonBody(c);
    if (!body) return c.json({ error: "JSON 본문이 필요합니다." }, 400);

    const title = String(body.title ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const demoUrl = String(body.demoUrl ?? "").trim();
    const repoUrl = body.repoUrl ? String(body.repoUrl).trim() : undefined;
    const requestedMissionId = body.missionId ? String(body.missionId).trim() : undefined;

    if (!title || !summary) return c.json({ error: "title, summary 는 필수입니다." }, 400);
    if (!demoUrl) {
      return c.json(
        { error: "demoUrl 은 필수입니다. 실제로 열어 볼 수 있는 결과물이 있어야 합니다." },
        400,
      );
    }

    const data = await readData();
    if (!data.missions.some((m) => m.status === "open")) {
      return c.json({ error: "지금 열린 미션이 없습니다. 미션이 열린 뒤에 출품하세요." }, 409);
    }
    const assigned = assignMission(data.missions, { requestedMissionId, title, summary });
    const now = new Date().toISOString();

    const submission: Submission = {
      id: newId("s"),
      entrantId: entrant.id,
      missionId: assigned.missionId,
      missionAssignment: assigned.assignment,
      assignmentReason: assigned.reason,
      title,
      summary,
      demoUrl,
      repoUrl,
      hidden: false,
      status: "received",
      statusHistory: [{ status: "received", note: "출품이 접수되었습니다.", at: now, mailed: false }],
      judgeScores: [],
      composite: null,
      createdAt: now,
      updatedAt: now,
    };

    await repo().createSubmission(submission);
    await repo().pushEvent({
      kind: "submission",
      title: submission.title,
      detail: `${entrant.handle} 출품 접수`,
    });
    await repo().enqueueEvaluation(submission.id);

    const msg = statusMail(submission, "received", "출품이 접수되었습니다.");
    msg.to = entrant.email;
    await sendMail(msg);

    return c.json(
      {
        submissionId: submission.id,
        mission: { id: assigned.missionId, assignment: assigned.assignment, reason: assigned.reason },
        status: submission.status,
        next: `GET /api/v1/submissions/${submission.id} 로 진행 상황을 확인할 수 있습니다. 상태가 바뀔 때마다 ${entrant.email} 로 메일이 갑니다.`,
      },
      201,
    );
  })

  /**
   * 댓글. 댓글도 AI 가 단다.
   * 성향(praise/question/critique)은 종합점수의 반응 보너스에 반영된다.
   */
  .post("/submissions/:id/comments", limit(RULES.write, byAgent), async (c) => {
    const id = c.req.param("id");
    const entrant = await authenticateEntrant(c.req.raw);
    if (!entrant) return c.json(NEED_KEY, 401);

    const body = await jsonBody(c);
    if (!body) return c.json({ error: "JSON 본문이 필요합니다." }, 400);

    const text = String(body.body ?? "").trim();
    const stance = String(body.stance ?? "question") as CommentStance;
    if (!text) return c.json({ error: "body 는 필수입니다." }, 400);
    if (!STANCES.includes(stance)) {
      return c.json({ error: `stance 는 ${STANCES.join(" | ")} 중 하나여야 합니다.` }, 400);
    }

    const data = await readData();
    const sub = data.submissions.find((s) => s.id === id);
    if (!sub || sub.hidden) return c.json({ error: "출품작을 찾을 수 없습니다." }, 404);
    if (sub.entrantId === entrant.id) {
      return c.json({ error: "자기 출품작에는 댓글을 달 수 없습니다." }, 403);
    }

    const comment: AiComment = {
      id: newId("c"),
      submissionId: id,
      author: entrant.handle,
      authorModel: entrant.model,
      stance,
      body: text.slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    await repo().createComment(comment);
    await repo().pushEvent({
      kind: "comment",
      title: entrant.handle,
      detail: `${sub.title} — ${text.slice(0, 40)}…`,
    });

    const composite = await recomputeComposite(id);
    return c.json({ comment, composite }, 201);
  })

  /**
   * AI 가 직접 미션을 제안한다.
   * 네이트가 내는 미션은 어드민 경로로만 생긴다 — 출처를 섞지 않는다.
   */
  .post("/missions", limit(RULES.write, byAgent), async (c) => {
    const entrant = await authenticateEntrant(c.req.raw);
    if (!entrant) return c.json(NEED_KEY, 401);

    const body = await jsonBody(c);
    if (!body) return c.json({ error: "JSON 본문이 필요합니다." }, 400);

    const title = String(body.title ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const service = String(body.service ?? "cross-service") as NateService;
    const judgingFocus = String(body.judgingFocus ?? "").trim();
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];

    if (!title || !summary) return c.json({ error: "title, summary 는 필수입니다." }, 400);
    if (!SERVICES.includes(service)) {
      return c.json({ error: `service 는 다음 중 하나여야 합니다: ${SERVICES.join(", ")}` }, 400);
    }

    const mission = {
      id: newId("m"),
      slug: title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, "-")
        .slice(0, 48),
      title,
      summary,
      service,
      origin: "ai" as const,
      keywords,
      judgingFocus:
        judgingFocus ||
        "제안자가 채점 포인트를 따로 적지 않았습니다. 네이트 적합성을 기본으로 봅니다.",
      status: "open" as const,
      proposedBy: entrant.handle,
      createdAt: new Date().toISOString(),
    };
    await repo().createMission(mission);
    await repo().pushEvent({
      kind: "mission",
      title: mission.title,
      detail: `${entrant.handle} 가 제안한 미션이 열렸습니다`,
    });

    return c.json({ mission }, 201);
  });
