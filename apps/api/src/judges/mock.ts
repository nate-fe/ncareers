import type { Mission, Submission } from "@ncareers/shared";
import type { JudgePersona } from "@ncareers/shared";
import type { RawJudgeOutput } from "./prompt";
import { NATE_SERVICES } from "./nate-context";

/** 문자열 → 0~1 결정론적 난수. 같은 출품작은 늘 같은 모의 점수를 받는다. */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * API 키가 없거나 호출이 실패했을 때 쓰는 모의 심판.
 * 무작위가 아니라 출품작의 실제 내용(데모 유무, 설명 길이, 네이트 용어 적중)을
 * 보고 매기기 때문에, 키를 꽂기 전에도 화면과 순위가 말이 되게 움직인다.
 */
export function mockJudge(
  persona: JudgePersona,
  submission: Submission,
  mission: Mission | undefined,
): RawJudgeOutput {
  const text = `${submission.title} ${submission.summary}`.toLowerCase();

  // 네이트 서비스 용어를 실제로 쓰고 있는지
  const serviceHit = NATE_SERVICES.some(
    (s) => text.includes(s.name.toLowerCase()) || text.includes(s.key),
  );
  const missionHit = mission
    ? mission.keywords.filter((k) => text.includes(k.toLowerCase())).length
    : 0;

  const base = (axis: string, floor: number, ceil: number) => {
    const r = hash01(`${submission.id}:${persona.id}:${axis}`);
    return Math.round(floor + r * (ceil - floor));
  };

  const axes = {
    nateFit: Math.min(20, base("nateFit", 7, 15) + (serviceHit ? 3 : 0) + Math.min(2, missionHit)),
    problem: Math.min(20, base("problem", 8, 15) + (submission.summary.length > 60 ? 2 : 0)),
    execution: Math.min(
      20,
      base("execution", 6, 13) + (submission.demoUrl ? 4 : 0) + (submission.repoUrl ? 2 : 0),
    ),
    originality: base("originality", 7, 16),
    impact: Math.min(20, base("impact", 7, 14) + (/\d/.test(submission.summary) ? 3 : 0)),
  };

  // 성향 반영: 자기가 엄하게 보는 축은 2점 깎는다.
  const strict = persona.strictOn as keyof typeof axes;
  if (strict in axes) axes[strict] = Math.max(0, axes[strict] - 2);

  const strengths: string[] = [];
  if (serviceHit) strengths.push("네이트 서비스 맥락을 구체적으로 지목했다.");
  if (submission.demoUrl) strengths.push("열어 볼 수 있는 데모 링크가 붙어 있다.");
  if (missionHit > 0) strengths.push("미션이 짚은 문제를 정면으로 다룬다.");
  if (strengths.length === 0) strengths.push("접근 자체는 읽히는 형태로 정리되어 있다.");

  const risks: string[] = [];
  if (!submission.demoUrl) risks.push("데모가 없어 동작 여부를 확인할 수 없다.");
  if (!serviceHit) risks.push("네이트의 어느 화면에 붙는지가 드러나지 않는다.");
  if (!/\d/.test(submission.summary)) risks.push("효과를 측정할 지표가 제시되지 않았다.");
  if (risks.length === 0) risks.push("도입 시 운영 비용에 대한 언급이 없다.");

  return {
    axes,
    verdict: `[모의 채점] ${persona.name}의 관점에서 ${persona.strictOn} 축을 중심으로 봤다. ${strengths[0]} 다만 ${risks[0]} API 키를 설정하면 ${persona.vendor} 실제 평가로 대체된다.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
  };
}
