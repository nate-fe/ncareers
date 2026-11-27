import { STATUS_LABEL, type SubmissionStatus } from "@ncareers/shared";

/**
 * 상태 칩. 중립 → 점선(진행 중) → 그린 테두리 → 그린 솔리드 → 먹색 솔리드로
 * 단계가 올라가고, 탈락만 포인트 레드를 쓴다.
 */
const TONE: Record<SubmissionStatus, string> = {
  received: "border-line text-ink-2",
  verifying: "border-line border-dashed text-muted",
  verified: "border-brand text-brand-ink",
  rejected: "border-point text-point-ink",
  judging: "border-line-2 border-dashed text-ink-2",
  scored: "border-transparent bg-brand text-on-brand",
  ranked: "border-transparent bg-ink-dark text-on-deep",
};

export function StatusPill({ status, small }: { status: SubmissionStatus; small?: boolean }) {
  return (
    <span
      className={`font-bold inline-flex items-center border ${TONE[status]} ${
        small ? "px-1.5 py-1 text-[12.5px]" : "px-2 py-1 text-[13px]"
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 출품 → 검증 → 평가 → 점수 → 순위 5단계 게이지 */
const STEPS: { key: string; label: string; reached: (s: SubmissionStatus) => boolean }[] = [
  { key: "in", label: "출품", reached: () => true },
  { key: "verify", label: "검증", reached: (s) => s !== "received" },
  { key: "judge", label: "평가", reached: (s) => ["judging", "scored", "ranked"].includes(s) },
  { key: "score", label: "점수", reached: (s) => ["scored", "ranked"].includes(s) },
  { key: "rank", label: "순위", reached: (s) => s === "ranked" },
];

export function ProgressTrack({ status }: { status: SubmissionStatus }) {
  if (status === "rejected") {
    return (
      <p className="font-bold text-[12.5px] text-point-ink">검증 탈락 · 평가 진행 안 됨</p>
    );
  }
  const done = STEPS.filter((s) => s.reached(status)).length;
  return (
    <div>
      <div className="flex gap-0.5" aria-hidden>
        {STEPS.map((step, i) => (
          <span
            key={step.key}
            className={`h-1.5 flex-1 ${i < done ? "bg-brand" : "bg-paper-2"}`}
          />
        ))}
      </div>
      <p className="font-bold mt-1.5 flex justify-between text-[12.5px] text-muted">
        <span className="text-brand-ink">{STEPS[done - 1]?.label ?? "출품"}</span>
        <span>
          {done}/{STEPS.length}
        </span>
      </p>
    </div>
  );
}
