import { Hono } from "hono";
import type { AdminLogInput } from "../repo";
import type { Mission, NateService } from "@ncareers/shared";
import { newId, readData, repo } from "../store";
import { authenticateAdmin } from "../auth";
import { recomputeComposite } from "../pipeline";
import { toMissionDtos, toQueueRows, toStats, toSubmissionSummaries } from "../live";

/**
 * 운영자 경로.
 *
 * 평가에는 손대지 않는다 — 점수를 고치는 메서드는 여기 없다. 운영자가 할 수 있는 건
 * 두 가지다: 미션을 내거나 닫는 것, 그리고 아레나에 둘 수 없는 출품작을 내리는 것.
 * "인간이 개입하면서도 개입하지 않는" 경계를 코드로 그어 둔 자리다.
 *
 * 모든 쓰기는 admin_actions 에 남는다.
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

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `mission-${Date.now().toString(36)}`
  );
}

async function log(entry: Omit<AdminLogInput, "actor">) {
  await repo().logAdminAction({ ...entry, actor: "admin" });
}

export const adminRoutes = new Hono()

  /** 토큰 검사는 한곳에서. 아래 모든 경로가 이걸 통과해야 한다. */
  .use("*", async (c, next) => {
    const check = authenticateAdmin(c.req.raw);
    if (!check.ok) return c.json({ error: check.error }, check.status);
    await next();
  })

  /** 어드민 첫 화면 — 숫자, 큐, 최근에 사람이 손댄 기록 */
  .get("/overview", async (c) => {
    const data = await readData();
    const [jobs, actions] = await Promise.all([
      repo().listJobs(20),
      repo().listAdminActions(20),
    ]);
    const stats = toStats(data);
    return c.json({
      backend: repo().backend,
      stats: {
        ...stats,
        hidden: data.submissions.filter((s) => s.hidden).length,
        comments: data.comments.length,
        pendingJobs: jobs.filter((j) => j.status === "queued" || j.status === "running").length,
      },
      queue: toQueueRows(data, jobs),
      recentActions: actions,
    });
  })

  /* ───────────── 미션 ───────────── */

  .get("/missions", async (c) => {
    const data = await readData();
    return c.json({ missions: toMissionDtos(data) });
  })

  /** 네이트 출제 미션은 이 경로로만 생긴다. origin 은 고정이다. */
  .post("/missions", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "JSON 본문이 필요합니다." }, 400);
    }

    const title = String(body.title ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const service = String(body.service ?? "cross-service") as NateService;
    const judgingFocus = String(body.judgingFocus ?? "").trim();
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];

    if (!title || !summary) return c.json({ error: "제목과 설명은 필수입니다." }, 400);
    if (!SERVICES.includes(service)) {
      return c.json({ error: `service 는 다음 중 하나여야 합니다: ${SERVICES.join(", ")}` }, 400);
    }
    if (!judgingFocus) {
      return c.json(
        { error: "심판이 무엇을 볼지(judgingFocus)는 필수입니다. 이 문장이 심판 프롬프트에 그대로 들어갑니다." },
        400,
      );
    }

    const mission: Mission = {
      id: newId("m"),
      slug: slugify(title),
      title,
      summary,
      service,
      origin: "nate",
      keywords,
      judgingFocus,
      status: body.status === "closed" ? "closed" : "open",
      createdAt: new Date().toISOString(),
    };

    await repo().createMission(mission);
    await log({ action: "mission.create", target: mission.id, detail: mission.title });
    if (mission.status === "open") {
      await repo().pushEvent({
        kind: "mission",
        title: mission.title,
        detail: "네이트가 낸 새 미션이 열렸습니다",
      });
    }
    return c.json({ mission }, 201);
  })

  /** 수정·열기·닫기. 보낸 필드만 바뀐다. */
  .patch("/missions/:id", async (c) => {
    const id = c.req.param("id");
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "JSON 본문이 필요합니다." }, 400);
    }

    const data = await readData();
    const before = data.missions.find((m) => m.id === id);
    if (!before) return c.json({ error: "미션을 찾을 수 없습니다." }, 404);

    const patch: Partial<Mission> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      patch.title = body.title.trim();
      patch.slug = slugify(patch.title);
    }
    if (typeof body.summary === "string" && body.summary.trim()) patch.summary = body.summary.trim();
    if (typeof body.judgingFocus === "string" && body.judgingFocus.trim()) {
      patch.judgingFocus = body.judgingFocus.trim();
    }
    if (typeof body.service === "string") {
      if (!SERVICES.includes(body.service as NateService)) {
        return c.json({ error: `service 는 다음 중 하나여야 합니다: ${SERVICES.join(", ")}` }, 400);
      }
      patch.service = body.service as NateService;
    }
    if (Array.isArray(body.keywords)) {
      patch.keywords = body.keywords.map((k) => String(k).trim()).filter(Boolean);
    }
    if (body.status === "open" || body.status === "closed") patch.status = body.status;

    if (Object.keys(patch).length === 0) return c.json({ error: "바꿀 내용이 없습니다." }, 400);

    await repo().updateMission(id, patch);
    const changed = Object.keys(patch)
      .filter((k) => k !== "slug")
      .join(", ");
    await log({
      action: "mission.update",
      target: id,
      detail: `${before.title} — ${changed} 수정`,
    });
    if (patch.status && patch.status !== before.status) {
      await repo().pushEvent({
        kind: "mission",
        title: before.title,
        detail: patch.status === "closed" ? "미션이 닫혔습니다" : "미션이 다시 열렸습니다",
      });
    }
    return c.json({ ok: true });
  })

  /**
   * 미션 삭제.
   * 출품작이 붙은 미션은 지우지 않는다 — 지우면 그 출품작의 평가 근거가 사라진다.
   * 그런 경우엔 닫기(status=closed)를 쓴다.
   */
  .delete("/missions/:id", async (c) => {
    const id = c.req.param("id");
    const data = await readData();
    const mission = data.missions.find((m) => m.id === id);
    if (!mission) return c.json({ error: "미션을 찾을 수 없습니다." }, 404);

    const used = data.submissions.filter((s) => s.missionId === id).length;
    if (used > 0) {
      return c.json(
        {
          error: `이 미션에 출품작 ${used}건이 붙어 있어 지울 수 없습니다. 닫기를 쓰세요.`,
          submissionCount: used,
        },
        409,
      );
    }

    await repo().deleteMission(id);
    await log({ action: "mission.delete", target: id, detail: mission.title });
    return c.json({ ok: true });
  })

  /* ───────────── 출품작 ───────────── */

  .get("/submissions", async (c) => {
    const data = await readData();
    return c.json({ submissions: toSubmissionSummaries(data) });
  })

  /**
   * 내리기·되돌리기.
   * 기본은 내리기다 — 지우는 건 따로 요청해야 한다.
   */
  .patch("/submissions/:id", async (c) => {
    const id = c.req.param("id");
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "JSON 본문이 필요합니다." }, 400);
    }

    const data = await readData();
    const sub = data.submissions.find((s) => s.id === id);
    if (!sub) return c.json({ error: "출품작을 찾을 수 없습니다." }, 404);

    const hidden = body.hidden !== false;
    const reason = String(body.reason ?? "").trim();
    if (hidden && !reason) {
      return c.json({ error: "내리는 이유를 적어 주세요. 기록에 남습니다." }, 400);
    }

    await repo().setSubmissionHidden(id, hidden, reason || undefined);
    await log({
      action: hidden ? "submission.hide" : "submission.unhide",
      target: id,
      detail: hidden ? `${sub.title} — ${reason}` : `${sub.title} — 되돌림`,
    });
    return c.json({ ok: true, hidden });
  })

  /**
   * 완전 삭제.
   * 점수·상태기록·댓글이 함께 사라지고 되돌릴 수 없다. 이유를 반드시 남긴다.
   */
  .delete("/submissions/:id", async (c) => {
    const id = c.req.param("id");
    const reason = (c.req.query("reason") ?? "").trim();
    const data = await readData();
    const sub = data.submissions.find((s) => s.id === id);
    if (!sub) return c.json({ error: "출품작을 찾을 수 없습니다." }, 404);
    if (!reason) {
      return c.json({ error: "지우는 이유(reason)를 반드시 적어야 합니다. 되돌릴 수 없습니다." }, 400);
    }

    await repo().deleteSubmission(id);
    await log({ action: "submission.delete", target: id, detail: `${sub.title} — ${reason}` });
    return c.json({ ok: true });
  })

  /**
   * 평가 다시 돌리기.
   * 심판이 전부 실패했거나 LLM 키를 나중에 꽂았을 때 쓴다.
   */
  .post("/submissions/:id/requeue", async (c) => {
    const id = c.req.param("id");
    const data = await readData();
    const sub = data.submissions.find((s) => s.id === id);
    if (!sub) return c.json({ error: "출품작을 찾을 수 없습니다." }, 404);

    await repo().enqueueEvaluation(id);
    await log({ action: "submission.requeue", target: id, detail: sub.title });
    return c.json({ ok: true, note: "큐에 넣었습니다. 워커가 집어 가면 상태가 바뀝니다." });
  })

  /* ───────────── 댓글 ───────────── */

  .delete("/comments/:id", async (c) => {
    const id = c.req.param("id");
    const reason = (c.req.query("reason") ?? "").trim();
    const data = await readData();
    const comment = data.comments.find((cm) => cm.id === id);
    if (!comment) return c.json({ error: "댓글을 찾을 수 없습니다." }, 404);
    if (!reason) return c.json({ error: "지우는 이유(reason)를 적어 주세요." }, 400);

    await repo().deleteComment(id);
    // 댓글이 빠지면 반응 보너스가 바뀌므로 종합점수를 다시 계산한다.
    await recomputeComposite(comment.submissionId);
    await log({
      action: "comment.delete",
      target: id,
      detail: `${comment.author} — ${reason}`,
    });
    return c.json({ ok: true });
  })

  /* ───────────── 기록 ───────────── */

  .get("/audit", async (c) => {
    const raw = Number(c.req.query("limit") ?? 100);
    const limit = Number.isFinite(raw) ? Math.max(1, Math.min(200, Math.trunc(raw))) : 100;
    return c.json({ actions: await repo().listAdminActions(limit) });
  });
