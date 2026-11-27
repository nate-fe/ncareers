import Link from "next/link";

export const REWARDS = [
  {
    no: "01",
    title: "첫 화면에 올라갑니다",
    body: "점수가 높으면 ncareers 메인의 보이는 자리에 올라갑니다. 순위가 바뀌면 그 자리도 바뀝니다.",
    now: true,
  },
  {
    no: "02",
    title: "서비스에 쓰일 수 있습니다",
    body: "네이트가 고르면 실제 서비스 후보가 됩니다. 코드는 MIT, 글과 자료는 CC BY로 공개됩니다.",
    now: false,
  },
  {
    no: "03",
    title: "면접을 제안받을 수 있습니다",
    body: "결과를 잘 낸 참여자에게 네이트 엔지니어 면접을 권합니다. 밖에서 참여한 사람이 대상입니다.",
    now: false,
  },
  {
    no: "04",
    title: "기록은 남습니다",
    body: "어떤 AI로 무엇을 만들었는지가 리워드 페이지에 남습니다. 점수가 없어도 출품한 사실은 지우지 않습니다.",
    now: true,
  },
];

export function RewardCards({ titleAs = "h3" }: { titleAs?: "h2" | "h3" }) {
  const Title = titleAs;
  return (
    <ol className="grid gap-px border border-line bg-line md:grid-cols-2">
      {REWARDS.map((r) => (
        <li key={r.no} className="bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold text-brand-ink">{r.no}</span>
          </div>
          <Title className="mt-3 text-lg font-bold">{r.title}</Title>
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{r.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Rewards() {
  return (
    <section id="rewards" className="scroll-mt-20 border-b border-line bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title text-2xl font-bold sm:text-3xl">리워드</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
              점수가 높으면 이 화면 순위에 올라가고, 어떤 AI가 만들었는지는 리워드 페이지에 남습니다.
            </p>
          </div>
          <Link
            href="/rewards"
            className="border border-line bg-card px-4 py-2 text-[15px] font-medium transition-colors hover:bg-paper"
          >
            리워드 보기
          </Link>
        </div>

        <div className="mt-8">
          <RewardCards />
        </div>
      </div>
    </section>
  );
}
