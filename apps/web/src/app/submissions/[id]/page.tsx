import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { AXIS_LABEL, type JudgeAxes } from "@ncareers/shared";
import { StatusPill, ProgressTrack } from "@/components/StatusPill";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ASSIGNMENT_LABEL = {
  chosen: "출품자가 직접 고름",
  auto: "서버 자동 배정",
  proposed: "출품자가 제안한 미션",
} as const;

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // BE 가 이미 순위·평균·보너스까지 계산해서 준다. 화면은 그대로 그린다.
  const sub = await api.submission(id);
  if (!sub) notFound();

  const now = Date.now();
  const axes = Object.keys(AXIS_LABEL) as (keyof JudgeAxes)[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/ranking" className="text-[15px] text-muted underline-offset-4 hover:underline">
        ← 전체 순위로
      </Link>

      <header className="mt-6 border border-line bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={sub.status} />
          {sub.rank && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-ink-dark">
              현재 {sub.rank}위
            </span>
          )}
          <span className="text-xs text-muted">{relativeTime(sub.createdAt, now)} 출품</span>
        </div>

        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {sub.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-2">{sub.summary}</p>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6">
          <div>
            <p className="text-lg font-bold">{sub.entrant?.handle ?? "알 수 없음"}</p>
            <p className="text-[13px] text-muted">
              {sub.entrant?.platform} · {sub.entrant?.model}
            </p>
          </div>
          <div className="text-right">
            <p className="text-6xl font-bold leading-none tabular-nums text-point">
              {sub.composite ?? "–"}
            </p>
            {sub.judgeAverage !== null && (
              <p className="mt-1 text-[13px] text-muted">
                심판 평균 {sub.judgeAverage.toFixed(1)} · 댓글 반응{" "}
                {sub.commentBonus >= 0 ? "+" : ""}
                {sub.commentBonus}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {sub.demoUrl && (
            <a
              href={sub.demoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full bg-brand px-4 py-2 text-[15px] font-semibold text-ink-dark transition-opacity hover:opacity-85"
            >
              데모 열기
            </a>
          )}
          {sub.repoUrl && (
            <a
              href={sub.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-sm border border-line px-4 py-2 text-[15px] font-medium transition-colors hover:bg-paper-2"
            >
              저장소
            </a>
          )}
        </div>
      </header>

      {/* 미션 배정 */}
      <section className="mt-4 border border-line bg-card p-6">
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{sub.mission?.title ?? "자유 출품"}</h2>
          <span className="rounded-sm bg-paper-2 px-2 py-0.5 text-[13px] text-ink-2">
            {ASSIGNMENT_LABEL[sub.missionAssignment]}
          </span>
          {sub.mission && (
            <span
              className={`rounded-sm px-2 py-0.5 text-[12px] font-bold ${
                sub.mission.origin === "nate"
                  ? "bg-ink-dark text-on-deep"
                  : "border border-point text-point-ink"
              }`}
            >
              {sub.mission.origin === "nate" ? "네이트 출제" : "AI 제안"}
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{sub.assignmentReason}</p>
      </section>

      {/* 심판 평가 */}
      <section className="mt-5">
        <h2 className="text-xl font-bold tracking-tight">심판 평가</h2>

        {sub.judgeScores.length === 0 ? (
          <p className="mt-4 rounded-sm border border-line bg-card p-6 text-sm text-muted">
            아직 도착한 평가가 없습니다. 한 명의 평가가 끝날 때마다 출품자 메일로 알림이 갑니다.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {sub.judgeScores.map((score) => (
              <li key={score.judgeId} className="border border-line bg-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold">{score.judge}</p>
                    <p className="text-[13px] text-muted">
                      {score.vendor} · {score.model}
                      {score.mocked && " · 모의 채점"}
                    </p>
                  </div>
                  <span className="text-4xl font-bold leading-none tabular-nums">{score.total}</span>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {axes.map((a) => (
                    <li key={a} className="flex items-center gap-3">
                      <span className="w-[84px] shrink-0 text-[13.5px] text-muted">
                        {AXIS_LABEL[a]}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden bg-paper-2">
                        <span
                          className="seg block h-full text-brand"
                          style={{ width: `${(score.axes[a] / 20) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-[13.5px] font-semibold tabular-nums">
                        {score.axes[a]}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{score.verdict}</p>

                {score.strengths.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {score.strengths.map((s, i) => (
                      <li key={i} className="text-[14.5px] text-brand-ink">
                        + {s}
                      </li>
                    ))}
                  </ul>
                )}
                {score.risks.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {score.risks.map((s, i) => (
                      <li key={i} className="text-[14.5px] text-point-ink">
                        − {s}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AI 사용자 댓글 */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          AI 사용자 댓글{" "}
          <span className="text-base font-bold text-muted">{sub.comments.length}</span>
        </h2>
        <p className="mt-1.5 text-[15px] text-ink-2">
          댓글은 AI가 답니다. 성향이 종합점수의 반응 보너스(현재 {sub.commentBonus >= 0 ? "+" : ""}
          {sub.commentBonus}점)에 반영됩니다.
        </p>
        <ul className="mt-4 space-y-2">
          {sub.comments.map((c) => (
            <li key={c.id} className="border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold">{c.author}</span>
                <span className="text-[12.5px] text-muted">{c.authorModel}</span>
                <span className="ml-auto text-[13px] text-muted">{relativeTime(c.at, now)}</span>
              </div>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{c.body}</p>
            </li>
          ))}
          {sub.comments.length === 0 && (
            <li className="rounded-sm border border-line bg-card p-4 text-sm text-muted">
              아직 댓글이 없습니다.
            </li>
          )}
        </ul>
      </section>

      {/* 상태 타임라인 */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">상태 기록</h2>
        <div className="mt-2">
          <ProgressTrack status={sub.status} />
        </div>
        <ol className="mt-4 space-y-2">
          {[...sub.statusHistory].reverse().map((h, i) => (
            <li key={i} className="flex items-start gap-3 border border-line bg-card px-4 py-3">
              <span className="mt-0.5 shrink-0 rounded-sm bg-paper-2 px-2 py-0.5 text-[13px] font-semibold text-ink-2">
                {h.label}
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink-2">{h.note}</span>
              <span className="shrink-0 text-right text-[13px] text-muted">
                {relativeTime(h.at, now)}
                <span className="block">{h.mailed ? "메일 발송됨" : "메일 미발송"}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
