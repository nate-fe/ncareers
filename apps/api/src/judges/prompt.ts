import type { Mission, Submission } from "@ncareers/shared";
import { nateKnowledgeBlock } from "./nate-context";
import type { JudgePersona } from "@ncareers/shared";

/** 네 심판이 공유하는 채점 규칙 */
export const RUBRIC = `채점은 다섯 축, 각 0~20점, 합계 0~100점이다.
- nateFit  (네이트 적합성): 네이트의 실제 서비스·이용자 맥락에 붙는가. 아무 포털에나 통하는 일반론이면 10점 이하.
- problem  (문제 정의): 무엇이 왜 불편한지 좁고 선명하게 짚었는가. 범위가 넓고 흐리면 깎는다.
- execution(구현 완성도): 열어 볼 수 있는 결과물인가. 데모 링크·저장소가 있고 설명과 일치하는가.
- originality(독창성): 이미 흔한 패턴인가, 네이트 맥락에서 새로 본 각도인가.
- impact   (사용자 임팩트): 얼마나 많은 이용자에게 얼마나 달라지는가. 측정 가능한 서술이 있으면 가산.

점수를 후하게 주지 마라. 평균적인 출품작은 축마다 10~13점이다. 18점 이상은 근거를 함께 적어라.`;

export const OUTPUT_CONTRACT = `반드시 아래 JSON 하나만 출력한다. 코드블록, 설명문, 머리말을 붙이지 않는다.
{
  "axes": { "nateFit": 0, "problem": 0, "execution": 0, "originality": 0, "impact": 0 },
  "verdict": "2~3문장 총평 (한국어)",
  "strengths": ["짧은 문장 1~3개"],
  "risks": ["짧은 문장 1~3개"]
}`;

export function buildSystemPrompt(persona: JudgePersona): string {
  return [
    nateKnowledgeBlock(),
    "",
    `[너의 자리] ${persona.name} — ${persona.seat}`,
    persona.temperament,
    `특히 엄하게 보는 축: ${persona.strictOn}. ${persona.accent}`,
    "",
    "[채점 규칙]",
    RUBRIC,
    "",
    "[출력 형식]",
    OUTPUT_CONTRACT,
  ].join("\n");
}

export function buildUserPrompt(submission: Submission, mission: Mission | undefined): string {
  return [
    "다음 출품작을 채점하라.",
    "",
    `미션: ${mission ? `${mission.title} (${mission.service})` : "미션 없음 — 자유 출품"}`,
    mission ? `미션 설명: ${mission.summary}` : "",
    mission ? `이 미션에서 특히 볼 지점: ${mission.judgingFocus}` : "",
    "",
    `제목: ${submission.title}`,
    `요약: ${submission.summary}`,
    `데모: ${submission.demoUrl || "(없음)"}`,
    `저장소: ${submission.repoUrl || "(없음)"}`,
    "",
    "JSON 하나만 출력하라.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface RawJudgeOutput {
  axes: { nateFit: number; problem: number; execution: number; originality: number; impact: number };
  verdict: string;
  strengths: string[];
  risks: string[];
}

/** 모델이 코드블록이나 군더더기를 붙여도 JSON만 끄집어낸다. */
export function parseJudgeOutput(text: string): RawJudgeOutput {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("심판 응답에서 JSON을 찾지 못했습니다.");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<RawJudgeOutput>;
  const a = parsed.axes ?? ({} as RawJudgeOutput["axes"]);
  const clamp = (n: unknown) => Math.max(0, Math.min(20, Math.round(Number(n) || 0)));
  return {
    axes: {
      nateFit: clamp(a.nateFit),
      problem: clamp(a.problem),
      execution: clamp(a.execution),
      originality: clamp(a.originality),
      impact: clamp(a.impact),
    },
    verdict: String(parsed.verdict ?? "").slice(0, 600) || "총평이 비어 있습니다.",
    strengths: (parsed.strengths ?? []).slice(0, 3).map((s) => String(s).slice(0, 200)),
    risks: (parsed.risks ?? []).slice(0, 3).map((s) => String(s).slice(0, 200)),
  };
}

/** 모든 공급자 어댑터가 따르는 모양 */
export interface JudgeAdapter {
  /** 실제 호출에 쓰는 모델 ID */
  model: string;
  /** 키가 없으면 false — 이때 모의 심판으로 폴백한다 */
  available(): boolean;
  run(system: string, user: string): Promise<string>;
}
