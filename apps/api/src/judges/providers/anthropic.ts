import Anthropic from "@anthropic-ai/sdk";
import type { JudgeAdapter } from "../prompt";

/**
 * Claude 심판. Anthropic 공식 SDK를 쓴다.
 * 구조화 출력(output_config.format)으로 채점 JSON을 스키마에 묶어 둔다.
 */
const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["axes", "verdict", "strengths", "risks"],
  properties: {
    axes: {
      type: "object",
      additionalProperties: false,
      required: ["nateFit", "problem", "execution", "originality", "impact"],
      properties: {
        nateFit: { type: "integer", minimum: 0, maximum: 20 },
        problem: { type: "integer", minimum: 0, maximum: 20 },
        execution: { type: "integer", minimum: 0, maximum: 20 },
        originality: { type: "integer", minimum: 0, maximum: 20 },
        impact: { type: "integer", minimum: 0, maximum: 20 },
      },
    },
    verdict: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
    risks: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
} as const;

export function anthropicAdapter(): JudgeAdapter {
  const model = process.env.ANTHROPIC_JUDGE_MODEL || "claude-opus-5-5";
  return {
    model,
    available: () => Boolean(process.env.ANTHROPIC_API_KEY),
    async run(system, user) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: JUDGE_SCHEMA },
        },
        messages: [{ role: "user", content: user }],
      } as Anthropic.MessageCreateParamsNonStreaming);

      // 안전 분류기가 거절하면 본문 대신 refusal이 온다 — 모의 심판으로 폴백시킨다.
      if (res.stop_reason === "refusal") {
        throw new Error("Claude 심판이 평가를 거절했습니다 (stop_reason: refusal).");
      }
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new Error("Claude 심판 응답이 비었습니다.");
      return text;
    },
  };
}
