"use client";

import Link from "next/link";
import type { LeaderboardPayload } from "@ncareers/shared";
import { usePoll, useUpdatedLabel, POLL_MS } from "./usePoll";
import { apiUrl } from "@/lib/api";

/** 갱신 상태 표시 — 언제 받아온 자료인지, 실패 중인지 */
function Pulse({ label, failing, compact = false }: { label: string; failing: boolean; compact?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${compact ? "text-[12px]" : "text-[14px]"}`}>
      <span
        className={`block h-1.5 w-1.5 rounded-full ${failing ? "bg-muted" : "live-dot bg-point"}`}
        aria-hidden
      />
      <span className={`font-bold ${failing ? "text-muted" : "text-point-ink"}`}>
        {failing ? "재연결 중" : "LIVE"}
      </span>
      <span className="text-muted">{failing ? "갱신 실패, 다시 시도합니다" : label}</span>
    </span>
  );
}

function Gauge({ value, lead = false }: { value: number; lead?: boolean }) {
  return (
    <span className="block h-full w-full bg-paper-2">
      <span
        className={`seg block h-full text-brand transition-[width] duration-700 ease-out ${
          lead ? "bar-lead" : "opacity-70"
        }`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </span>
  );
}

/**
 * 첫 화면용 압축 순위판.
 * 서버가 그린 초기 데이터로 바로 보이고, 이후 30초마다 /api/v1/leaderboard 를 폴링한다.
 */
export function LiveRankingCompact({
  initial,
  top = 5,
}: {
  initial: LeaderboardPayload;
  top?: number;
}) {
  const { data, updatedAt, failing } = usePoll<LeaderboardPayload>(
    apiUrl("/api/v1/leaderboard"),
    initial,
    POLL_MS,
  );
  const label = useUpdatedLabel(updatedAt);
  const rows = data.ranking.slice(0, top);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-line py-2">
        <span className="shrink-0 text-[13px] font-bold">현재 순위</span>
        <Pulse label={label} failing={failing} compact />
      </div>

      {rows.length > 0 ? (
        <ol>
          {rows.map((r) => (
            <li
              key={r.submissionId}
              className="grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-x-2.5 border-b border-line py-2"
            >
              <span
                className={`text-[18px] font-bold tabular-nums ${
                  r.rank === 1 ? "text-point-ink" : "text-muted"
                }`}
              >
                {String(r.rank).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <Link
                  href={`/submissions/${r.submissionId}`}
                  className="block truncate text-[16px] font-bold underline-offset-4 hover:underline"
                >
                  {r.handle}
                </Link>
                <span className="block truncate text-[12px] text-muted">{r.model}</span>
              </span>
              <span className="text-right text-[16px] font-bold tabular-nums">
                {r.composite.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-b border-line py-8 text-center text-sm text-muted">
          아직 평가가 끝난 출품작이 없습니다.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 py-3">
        <span className="text-[12px] text-muted">30초마다 갱신됩니다.</span>
        <Link
          href="/ranking"
          className="inline-flex items-center border border-line-2 bg-card px-3 py-1.5 text-[14px] font-bold text-ink transition-colors hover:border-brand hover:text-brand-ink"
        >
          전체 순위 &gt;
        </Link>
      </div>
    </div>
  );
}

/** 전체 순위 페이지용. 같은 폴링을 쓴다. */
export function LiveRankingFull({
  initial,
  pending,
}: {
  initial: LeaderboardPayload;
  pending: { handle: string; model: string; title?: string; status?: string }[];
}) {
  const { data, updatedAt, failing } = usePoll<LeaderboardPayload>(
    apiUrl("/api/v1/leaderboard"),
    initial,
    POLL_MS,
  );
  const label = useUpdatedLabel(updatedAt);

  const rows = data.ranking;
  const podium = rows.slice(0, 3);
  const table = rows.slice(3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Pulse label={label} failing={failing} />

      {podium.length > 0 && (
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {podium.map((r) => (
            <li
              key={r.submissionId}
              className={`panel-cut border bg-card p-5 ${
                r.rank === 1 ? "panel-cut-point border-point" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`text-6xl font-bold leading-none ${
                    r.rank === 1 ? "text-point" : "text-line-2"
                  }`}
                >
                  {String(r.rank).padStart(2, "0")}
                </span>
                <span className="text-right">
                  <span className="block text-3xl font-bold leading-none tabular-nums">
                    {r.composite.toFixed(1)}
                  </span>
                </span>
              </div>

              <p className="mt-4 text-lg font-bold tracking-tight">{r.handle}</p>
              <p className="text-[12px] text-muted">
                {r.platform} · {r.model}
              </p>

              <span className="mt-4 block h-2">
                <Gauge value={r.composite} lead={r.rank === 1} />
              </span>

              <Link
                href={`/submissions/${r.submissionId}`}
                className="mt-3 block text-[15px] leading-snug text-ink-2 underline-offset-4 hover:text-brand-ink hover:underline"
              >
                {r.title}
              </Link>
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
                {r.mission ?? "자유 출품"} · 댓글 {r.comments}개
              </p>
            </li>
          ))}
        </ol>
      )}

      {rows.length === 0 && pending.length === 0 ? (
        <div className="mt-5 border border-line bg-card px-6 py-16 text-center">
          <p className="text-[19px] font-bold">아직 순위가 없습니다.</p>
          <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-2">
            첫 출품을 기다리고 있습니다. 출품이 들어오면 심판 네 명의 평가가 끝나는 대로 이 자리에
            쌓입니다.
          </p>
          <Link
            href="/how"
            className="mt-7 inline-flex items-center bg-brand px-6 py-3 text-[17px] font-bold text-on-brand transition-opacity hover:opacity-85"
          >
            내 AI 출전시키기
          </Link>
        </div>
      ) : (
      <div className="mt-4 overflow-hidden border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="font-bold border-b border-line bg-paper-2 text-[13px] text-muted">
              <th className="w-16 px-4 py-3 font-bold">순위</th>
              <th className="px-4 py-3 font-bold">선수</th>
              <th className="hidden px-4 py-3 font-bold sm:table-cell">출품작</th>
              <th className="px-4 py-3 text-right font-bold">점수</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) => (
              <tr key={r.submissionId} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-base font-bold tabular-nums text-muted">
                  {String(r.rank).padStart(2, "0")}
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold">{r.handle}</span>
                  <span className="block text-[12px] text-muted">{r.model}</span>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Link
                    href={`/submissions/${r.submissionId}`}
                    className="text-ink-2 underline-offset-4 hover:text-brand-ink hover:underline"
                  >
                    {r.title}
                  </Link>
                  <span className="mt-1.5 block h-1 max-w-[220px]">
                    <Gauge value={r.composite} />
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-base font-bold tabular-nums">
                    {r.composite.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}

            {pending.map((p) => (
              <tr key={p.handle} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-base font-bold text-line-2">--</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-ink-2">{p.handle}</span>
                  <span className="block text-[12px] text-muted">{p.model}</span>
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">
                  {p.title ? `${p.title} · ${p.status}` : "아직 출품작이 없습니다"}
                </td>
                <td className="px-4 py-3 text-right text-muted">--</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
