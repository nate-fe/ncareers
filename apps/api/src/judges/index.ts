import type { JudgeId, JudgeScore, Mission, Submission } from "@ncareers/shared";
import { JUDGES, JUDGE_ORDER, type JudgePersona } from "@ncareers/shared";
import { buildSystemPrompt, buildUserPrompt, parseJudgeOutput, type JudgeAdapter } from "./prompt";
import { anthropicAdapter } from "./providers/anthropic";
import { geminiAdapter, grokAdapter, openaiAdapter } from "./providers/rest";
import { mockJudge } from "./mock";

export { JUDGES, JUDGE_ORDER };
export type { JudgePersona };

function adapterFor(id: JudgeId): JudgeAdapter {
  switch (id) {
    case "gpt":
      return openaiAdapter();
    case "claude":
      return anthropicAdapter();
    case "gemini":
      return geminiAdapter();
    case "grok":
      return grokAdapter();
  }
}

/** 네 심판의 연결 상태 — 화면에 "실제 호출 / 모의" 배지로 보여 준다. */
export function judgeStatus(): { id: JudgeId; name: string; vendor: string; model: string; live: boolean }[] {
  return JUDGE_ORDER.map((id) => {
    const a = adapterFor(id);
    return { id, name: JUDGES[id].name, vendor: JUDGES[id].vendor, model: a.model, live: a.available() };
  });
}

function toScore(
  persona: JudgePersona,
  model: string,
  raw: ReturnType<typeof parseJudgeOutput>,
  mocked: boolean,
): JudgeScore {
  const total =
    raw.axes.nateFit + raw.axes.problem + raw.axes.execution + raw.axes.originality + raw.axes.impact;
  return {
    judgeId: persona.id,
    model,
    axes: raw.axes,
    total,
    verdict: raw.verdict,
    strengths: raw.strengths,
    risks: raw.risks,
    mocked,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 심판 하나를 돌린다.
 * 키가 없거나 호출이 실패하면 모의 심판으로 폴백한다 — 평가가 중간에 멈추지 않게.
 */
export async function runJudge(
  judgeId: JudgeId,
  submission: Submission,
  mission: Mission | undefined,
): Promise<JudgeScore> {
  const persona = JUDGES[judgeId];
  const adapter = adapterFor(judgeId);

  if (adapter.available()) {
    try {
      const text = await adapter.run(buildSystemPrompt(persona), buildUserPrompt(submission, mission));
      return toScore(persona, adapter.model, parseJudgeOutput(text), false);
    } catch (err) {
      console.warn(`[judge:${judgeId}] 실제 호출 실패, 모의 채점으로 폴백합니다:`, err);
    }
  }
  return toScore(persona, "mock", mockJudge(persona, submission, mission), true);
}
