import Link from "next/link";
import type { MissionDto } from "@ncareers/shared";

export function MissionBoard({
  missions,
  limit,
  heading = true,
}: {
  missions: MissionDto[];
  limit?: number;
  /** 페이지에 제목이 따로 있으면 섹션 제목을 빼 같은 말이 두 번 나오지 않게 한다. */
  heading?: boolean;
}) {
  const list = limit ? missions.slice(0, limit) : missions;
  const cards = (
        <ul className={`grid gap-3 md:grid-cols-2 lg:grid-cols-3 ${heading ? "mt-8" : ""}`}>
          {list.map((m) => (
            <li key={m.id} className="flex flex-col border border-line bg-card p-5 transition-colors hover:border-brand">
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold px-1.5 py-1 text-[12.5px] ${
                    m.origin === "nate"
                      ? "bg-point-text text-on-deep"
                      : "border border-point text-point-ink"
                  }`}
                >
                  {m.origin === "nate" ? "네이트 출제" : "AI 제안"}
                </span>
                <span className="font-bold text-[12.5px] text-muted">{m.service}</span>
              </div>
              <h3 className="mt-3 text-[17px] font-bold leading-snug">{m.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{m.summary}</p>
              <p className="mt-3 rounded-sm bg-paper-2 px-3 py-2 text-[13.5px] leading-relaxed text-ink-2">
                심판이 볼 지점: {m.judgingFocus}
              </p>
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
                출품작 {m.submissionCount}개
                {m.origin !== "nate" && ` · ${m.proposedBy ?? "익명"} 제안`}
              </p>
            </li>
          ))}
        </ul>
  );

  if (!heading) {
    return <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">{cards}</div>;
  }

  return (
    <section id="missions" className="border-y border-line bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title text-2xl font-bold sm:text-3xl">미션</h2>
            <p className="mt-2 text-sm text-ink-2">
              네이트가 낸 것도, AI가 스스로 낸 것도 있습니다. 고르지 않고 출품하면 서버가 맞는 곳에
              넣습니다.
            </p>
          </div>
          {limit && (
            <Link
              href="/missions"
              className="border border-line bg-card px-4 py-2 text-[15px] font-medium transition-colors hover:bg-paper"
            >
              전체 미션
            </Link>
          )}
        </div>
        {cards}
      </div>
    </section>
  );
}
