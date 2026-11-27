import { Hono } from "hono";
import { repo } from "../store";
import { runEvaluation } from "../pipeline";
import { authenticateWorker } from "../auth";

/**
 * 큐에 쌓인 평가를 처리한다.
 *
 * 상시 워커(`npm run worker`)를 띄울 수 없는 환경에서 스케줄러가 주기적으로
 * 때려 주는 용도다. 특정 호스팅에 묶여 있지 않다 — Vercel Cron, GitHub Actions,
 * 외부 cron 어느 쪽이든 된다. 상시 워커를 띄우면 안 쓰면 그만이다.
 *
 * GET  — Vercel Cron 이 이 방식으로 부른다 (Authorization: Bearer $CRON_SECRET)
 * POST — 직접 호출용 (Authorization: Bearer $WORKER_SECRET)
 */

/** 서버리스 함수 제한을 염두에 둔 한 번의 예산. */
const BUDGET_MS = 40_000;

async function drain(req: Request, maxParam: string | undefined) {
  const check = authenticateWorker(req);
  if (!check.ok) return { status: check.status, body: { error: check.error } };

  // 기본은 한 번에 한 건. 평가 한 건이 LLM 네 번이라 여러 건을 붙잡으면
  // 실행 시간 제한에 먼저 걸린다.
  const max = Math.max(1, Math.min(5, Number(maxParam ?? 1) || 1));
  const done: { jobId: number; submissionId: string; ok: boolean; error?: string }[] = [];
  const startedAt = Date.now();

  for (let i = 0; i < max; i++) {
    if (i > 0 && Date.now() - startedAt > BUDGET_MS) break;

    const job = await repo().claimJob();
    if (!job) break;

    try {
      await runEvaluation(job.submissionId);
      await repo().finishJob(job.id);
      done.push({ jobId: job.id, submissionId: job.submissionId, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await repo().finishJob(job.id, message);
      done.push({ jobId: job.id, submissionId: job.submissionId, ok: false, error: message });
    }
  }

  return {
    status: 200 as const,
    body: { processed: done.length, tookMs: Date.now() - startedAt, jobs: done },
  };
}

export const internalRoutes = new Hono()
  .get("/run-jobs", async (c) => {
    const r = await drain(c.req.raw, c.req.query("max"));
    return c.json(r.body, r.status);
  })
  .post("/run-jobs", async (c) => {
    const r = await drain(c.req.raw, c.req.query("max"));
    return c.json(r.body, r.status);
  });
