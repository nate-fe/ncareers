import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "./client";
import { schema } from "./client";
import {
  MAX_JOB_ATTEMPTS,
  SEASON,
  STALE_JOB_MS,
  type AdminLogInput,
  type ClaimedJob,
  type JobRow,
  type Repo,
} from "../repo";
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

const iso = (d: Date) => d.toISOString();

/** Postgres 백엔드. 읽기는 통짜 한 번, 쓰기는 행 단위. */
export function pgRepo(db: Db): Repo {
  return {
    backend: "postgres",

    async read(): Promise<ArenaData> {
      const [entrantRows, missionRows, submissionRows, statusRows, scoreRows, commentRows, feedRows] =
        await Promise.all([
          db.select().from(schema.entrants).orderBy(asc(schema.entrants.createdAt)),
          db.select().from(schema.missions).orderBy(asc(schema.missions.createdAt)),
          db.select().from(schema.submissions).orderBy(asc(schema.submissions.createdAt)),
          db.select().from(schema.statusEvents).orderBy(asc(schema.statusEvents.id)),
          db.select().from(schema.judgeScores).orderBy(asc(schema.judgeScores.id)),
          db.select().from(schema.comments).orderBy(asc(schema.comments.createdAt)),
          db.select().from(schema.feedEvents).orderBy(desc(schema.feedEvents.at)).limit(120),
        ]);

      const historyBySub = new Map<string, StatusEvent[]>();
      for (const r of statusRows) {
        const list = historyBySub.get(r.submissionId) ?? [];
        list.push({ status: r.status, note: r.note, at: iso(r.at), mailed: r.mailed });
        historyBySub.set(r.submissionId, list);
      }

      const scoresBySub = new Map<string, JudgeScore[]>();
      for (const r of scoreRows) {
        const list = scoresBySub.get(r.submissionId) ?? [];
        list.push({
          judgeId: r.judgeId as JudgeScore["judgeId"],
          model: r.model,
          axes: r.axes,
          total: r.total,
          verdict: r.verdict,
          strengths: r.strengths,
          risks: r.risks,
          mocked: r.mocked,
          createdAt: iso(r.createdAt),
        });
        scoresBySub.set(r.submissionId, list);
      }

      return {
        season: SEASON,
        entrants: entrantRows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
        missions: missionRows.map((r) => ({
          ...r,
          proposedBy: r.proposedBy ?? undefined,
          createdAt: iso(r.createdAt),
        })),
        submissions: submissionRows.map((r) => ({
          ...r,
          repoUrl: r.repoUrl ?? undefined,
          hiddenReason: r.hiddenReason ?? undefined,
          statusHistory: historyBySub.get(r.id) ?? [],
          judgeScores: scoresBySub.get(r.id) ?? [],
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        })),
        comments: commentRows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
        feed: feedRows.map((r) => ({
          id: String(r.id),
          kind: r.kind as FeedEvent["kind"],
          title: r.title,
          detail: r.detail,
          at: iso(r.at),
        })),
      };
    },

    async createEntrant(e: Entrant) {
      await db.insert(schema.entrants).values({ ...e, createdAt: new Date(e.createdAt) });
    },

    async createMission(m: Mission) {
      await db.insert(schema.missions).values({ ...m, createdAt: new Date(m.createdAt) });
    },

    async createSubmission(s: Submission) {
      await db.transaction(async (tx) => {
        await tx.insert(schema.submissions).values({
          id: s.id,
          entrantId: s.entrantId,
          missionId: s.missionId,
          missionAssignment: s.missionAssignment,
          assignmentReason: s.assignmentReason,
          title: s.title,
          summary: s.summary,
          demoUrl: s.demoUrl,
          repoUrl: s.repoUrl ?? null,
          status: s.status,
          hidden: s.hidden,
          hiddenReason: s.hiddenReason ?? null,
          composite: s.composite,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        });
        if (s.statusHistory.length > 0) {
          await tx.insert(schema.statusEvents).values(
            s.statusHistory.map((h) => ({
              submissionId: s.id,
              status: h.status,
              note: h.note,
              mailed: h.mailed,
              at: new Date(h.at),
            })),
          );
        }
      });
    },

    async createComment(c: AiComment) {
      await db.insert(schema.comments).values({ ...c, createdAt: new Date(c.createdAt) });
    },

    async advanceStatus(submissionId: string, status: SubmissionStatus, event: StatusEvent) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.submissions)
          .set({ status, updatedAt: new Date(event.at) })
          .where(eq(schema.submissions.id, submissionId));
        await tx.insert(schema.statusEvents).values({
          submissionId,
          status: event.status,
          note: event.note,
          mailed: event.mailed,
          at: new Date(event.at),
        });
      });
    },

    async putJudgeScore(submissionId: string, score: JudgeScore) {
      await db.transaction(async (tx) => {
        await tx
          .delete(schema.judgeScores)
          .where(
            and(
              eq(schema.judgeScores.submissionId, submissionId),
              eq(schema.judgeScores.judgeId, score.judgeId),
            ),
          );
        await tx.insert(schema.judgeScores).values({
          submissionId,
          judgeId: score.judgeId,
          model: score.model,
          axes: score.axes,
          total: score.total,
          verdict: score.verdict,
          strengths: score.strengths,
          risks: score.risks,
          mocked: score.mocked,
          createdAt: new Date(score.createdAt),
        });
        await tx
          .update(schema.submissions)
          .set({ updatedAt: new Date() })
          .where(eq(schema.submissions.id, submissionId));
      });
    },

    async setComposite(submissionId: string, composite: number | null) {
      await db
        .update(schema.submissions)
        .set({ composite, updatedAt: new Date() })
        .where(eq(schema.submissions.id, submissionId));
    },

    async pushEvent(event: Omit<FeedEvent, "id" | "at">) {
      await db.insert(schema.feedEvents).values(event);
    },

    async enqueueEvaluation(submissionId: string) {
      await db.insert(schema.jobs).values({ kind: "evaluate", payload: { submissionId } });
    },

    async claimJob(): Promise<ClaimedJob | null> {
      // SKIP LOCKED 덕분에 워커를 여러 개 띄워도 같은 작업을 두 번 집지 않는다.
      const rows = await db.execute<{
        id: number;
        kind: "evaluate";
        payload: { submissionId: string };
        attempts: number;
      }>(sql`
        UPDATE jobs
           SET status = 'running',
               attempts = attempts + 1,
               updated_at = now()
         WHERE id = (
           SELECT id FROM jobs
            WHERE (
                    status = 'queued'
                    OR (status = 'running' AND updated_at < now() - make_interval(secs => ${STALE_JOB_MS / 1000}))
                  )
              AND run_after <= now()
            ORDER BY id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
        RETURNING id, kind, payload, attempts
      `);
      const row = rows.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        kind: row.kind,
        submissionId: row.payload.submissionId,
        attempts: row.attempts,
      };
    },

    async finishJob(id: number, error?: string) {
      if (!error) {
        await db
          .update(schema.jobs)
          .set({ status: "done", updatedAt: new Date(), lastError: null })
          .where(eq(schema.jobs.id, id));
        return;
      }
      // 재시도 여유가 남았으면 백오프를 두고 다시 큐에 올린다.
      await db.execute(sql`
        UPDATE jobs
           SET status = CASE WHEN attempts >= ${MAX_JOB_ATTEMPTS} THEN 'failed' ELSE 'queued' END,
               last_error = ${error},
               run_after = now() + (interval '30 seconds' * attempts),
               updated_at = now()
         WHERE id = ${id}
      `);
    },

    /* ───────────── 어드민 ───────────── */

    async updateMission(id: string, patch: Partial<Mission>) {
      const next: Record<string, unknown> = {};
      if (patch.title !== undefined) next.title = patch.title;
      if (patch.slug !== undefined) next.slug = patch.slug;
      if (patch.summary !== undefined) next.summary = patch.summary;
      if (patch.service !== undefined) next.service = patch.service;
      if (patch.keywords !== undefined) next.keywords = patch.keywords;
      if (patch.judgingFocus !== undefined) next.judgingFocus = patch.judgingFocus;
      if (patch.status !== undefined) next.status = patch.status;
      if (Object.keys(next).length === 0) return;
      await db.update(schema.missions).set(next).where(eq(schema.missions.id, id));
    },

    async deleteMission(id: string) {
      await db.delete(schema.missions).where(eq(schema.missions.id, id));
    },

    async setSubmissionHidden(id: string, hidden: boolean, reason?: string) {
      await db
        .update(schema.submissions)
        .set({ hidden, hiddenReason: hidden ? (reason ?? null) : null, updatedAt: new Date() })
        .where(eq(schema.submissions.id, id));
    },

    async deleteSubmission(id: string) {
      // status_events·judge_scores·comments 는 on delete cascade 로 함께 지워진다.
      // jobs 는 FK 가 없으므로(큐는 출품작보다 오래 산다) 여기서 직접 닫는다.
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE jobs SET status = 'done', updated_at = now()
           WHERE payload->>'submissionId' = ${id} AND status IN ('queued', 'running')
        `);
        await tx.delete(schema.submissions).where(eq(schema.submissions.id, id));
      });
    },

    async deleteComment(id: string) {
      await db.delete(schema.comments).where(eq(schema.comments.id, id));
    },

    async logAdminAction(entry: AdminLogInput) {
      await db.insert(schema.adminActions).values(entry);
    },

    async listAdminActions(limit: number): Promise<AdminActionDto[]> {
      const rows = await db
        .select()
        .from(schema.adminActions)
        .orderBy(desc(schema.adminActions.id))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        action: r.action as AdminActionKind,
        target: r.target,
        detail: r.detail,
        actor: r.actor,
        at: iso(r.at),
      }));
    },

    async listJobs(limit: number): Promise<JobRow[]> {
      const rows = await db.select().from(schema.jobs).orderBy(desc(schema.jobs.id)).limit(limit);
      return rows.map((r) => ({
        id: r.id,
        submissionId: r.payload.submissionId,
        status: r.status,
        attempts: r.attempts,
        lastError: r.lastError ?? undefined,
        runAfter: iso(r.runAfter),
        updatedAt: iso(r.updatedAt),
      }));
    },
  };
}

/** 큐에 남은 작업 수 — 운영 확인용 */
export async function queueDepth(db: Db): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.status, "queued"), lte(schema.jobs.runAfter, new Date())));
  return rows[0]?.n ?? 0;
}
