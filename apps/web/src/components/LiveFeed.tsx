"use client";

import type { FeedEvent } from "@ncareers/shared";
import { relativeTime } from "@/lib/format";
import { apiUrl } from "@/lib/api";
import { usePoll, useUpdatedLabel, POLL_MS } from "./usePoll";

const KIND_LABEL: Record<FeedEvent["kind"], string> = {
  submission: "출품",
  status: "상태",
  judge: "평가 도착",
  score: "점수 확정",
  comment: "댓글",
  mission: "미션",
};

const KIND_TONE: Record<FeedEvent["kind"], string> = {
  submission: "border-line text-ink-2",
  status: "border-line text-muted",
  judge: "border-brand text-brand-ink",
  score: "border-transparent bg-brand text-on-brand",
  comment: "border-point text-point-ink",
  mission: "border-transparent bg-ink-dark text-on-deep",
};

interface Payload {
  events: FeedEvent[];
}

/** 30초마다 /api/v1/events?limit=30 을 폴링한다. */
export function LiveFeed({ initial }: { initial: Payload }) {
  const { data, updatedAt, failing } = usePoll<Payload>(
    apiUrl("/api/v1/events?limit=30"),
    initial,
    POLL_MS,
  );
  const label = useUpdatedLabel(updatedAt);
  const now = Date.now();

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title text-2xl font-bold sm:text-3xl">실황</h2>
          <p className="mt-2 text-sm text-ink-2">
            출품, 검증, 심판별 평가 도착, 점수 확정, 댓글까지 생기는 대로 쌓입니다. 같은 내용이
            출품자 메일로도 나갑니다.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[14px]">
          <span
            className={`block h-1.5 w-1.5 rounded-full ${failing ? "bg-muted" : "live-dot bg-point"}`}
            aria-hidden
          />
          <span className={`font-bold ${failing ? "text-muted" : "text-point-ink"}`}>
            {failing ? "재연결 중" : "LIVE"}
          </span>
          <span className="text-muted">{label}</span>
        </span>
      </div>

      <ul className="mt-6 divide-y divide-line border border-line bg-card">
        {data.events.slice(0, 16).map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`font-bold mt-0.5 shrink-0 border px-1.5 py-1 text-[12.5px] ${KIND_TONE[e.kind]}`}
            >
              {KIND_LABEL[e.kind]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-title text-[15.5px] font-bold">{e.title}</span>
              <span className="block truncate text-[14px] text-muted">{e.detail}</span>
            </span>
            <span className="font-bold shrink-0 text-[12.5px] text-muted">{relativeTime(e.at, now)}</span>
          </li>
        ))}
        {data.events.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">아직 기록이 없습니다.</li>
        )}
      </ul>
    </section>
  );
}
