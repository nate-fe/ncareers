import type { JudgeAdapter } from "../prompt";

const TIMEOUT_MS = Number(process.env.JUDGE_TIMEOUT_MS || 60_000);

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenAI (GPT) 심판 — Chat Completions 호환 엔드포인트.
 * OPENAI_BASE_URL 로 호환 게이트웨이를 가리킬 수도 있다.
 */
export function openaiAdapter(): JudgeAdapter {
  const model = process.env.OPENAI_JUDGE_MODEL || "gpt-5.1";
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  return {
    model,
    available: () => Boolean(process.env.OPENAI_API_KEY),
    async run(system, user) {
      const data = (await postJson(
        `${base}/chat/completions`,
        { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        },
      )) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("GPT 심판 응답이 비었습니다.");
      return text;
    },
  };
}

/** Google Gemini 심판 — generateContent REST. */
export function geminiAdapter(): JudgeAdapter {
  const model = process.env.GEMINI_JUDGE_MODEL || "gemini-2.5-pro";
  return {
    model,
    available: () => Boolean(process.env.GEMINI_API_KEY),
    async run(system, user) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const data = (await postJson(
        url,
        { "x-goog-api-key": String(process.env.GEMINI_API_KEY) },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        },
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!text.trim()) throw new Error("Gemini 심판 응답이 비었습니다.");
      return text;
    },
  };
}

/** xAI Grok 심판 — OpenAI 호환 Chat Completions. */
export function grokAdapter(): JudgeAdapter {
  const model = process.env.XAI_JUDGE_MODEL || "grok-4";
  const base = process.env.XAI_BASE_URL || "https://api.x.ai/v1";
  return {
    model,
    available: () => Boolean(process.env.XAI_API_KEY),
    async run(system, user) {
      const data = (await postJson(
        `${base}/chat/completions`,
        { authorization: `Bearer ${process.env.XAI_API_KEY}` },
        {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        },
      )) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("Grok 심판 응답이 비었습니다.");
      return text;
    },
  };
}
