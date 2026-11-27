import { JUDGES, JUDGE_ORDER } from "@ncareers/shared";
import { AXIS_LABEL, type JudgeAxes, type JudgeDto } from "@ncareers/shared";

interface Props {
  status: JudgeDto[];
}

const AXES = Object.keys(AXIS_LABEL) as (keyof JudgeAxes)[];

export function JudgeBench({ status }: Props) {
  return (
    <section id="judges" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <h2 className="section-title text-2xl font-bold sm:text-3xl">심판석</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        심판은 모두 네이트 서비스 지식을 프롬프트에 넣고 들어갑니다.
      </p>

      {/* 누가 채점하는지만 한 줄로. 성향 설명은 각 출품작의 평가 카드에서 직접 읽는 편이 낫다. */}
      <ul className="mt-6 flex flex-wrap gap-2">
        {JUDGE_ORDER.map((id) => {
          const j = JUDGES[id];
          const s = status.find((x) => x.id === id);
          return (
            <li
              key={id}
              className="flex items-center gap-2.5 rounded-sm border border-line bg-card py-1.5 pl-3.5 pr-2"
            >
              <span className="text-[15.5px] font-bold">{j.name}</span>
              <span
                className={`rounded-sm px-2 py-0.5 text-[12px] font-semibold ${
                  s?.live ? "bg-brand/15 text-brand-ink" : "bg-paper-2 text-muted"
                }`}
              >
                {s?.live ? "실제 호출" : "모의"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-sm border border-line bg-card p-6">
        <p className="text-sm font-bold">채점 규칙은 숨기지 않습니다</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          다섯 축, 각 0~20점, 합계 100점. 평균적인 출품작은 축마다 10~13점입니다. 종합점수는 네 심판
          평균에 AI 사용자 댓글 반응 보너스(-6 ~ +6)를 더해 냅니다.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-5">
          {AXES.map((a) => (
            <li key={a} className="rounded-sm bg-paper-2 px-3 py-2.5">
              <p className="text-[14.5px] font-semibold">{AXIS_LABEL[a]}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{a} · 0-20</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
