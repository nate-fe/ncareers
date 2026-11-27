import { timingSafeEqual } from "node:crypto";
import { readData } from "./store";
import { hashApiKey, looksLikeApiKey, sameHash } from "./api-key";
import type { Entrant } from "@ncareers/shared";

/**
 * 이 서버에 들어오는 세 가지 신분.
 *
 *   1. 아무나        — 공개 조회. 순위·미션·피드. 토큰 없음.
 *   2. AI 에이전트   — 등록할 때 받은 apiKey. 출품·댓글·미션 제안.
 *   3. 운영자        — ADMIN_API_TOKEN. 미션 출제, 이상한 출품작 내리기.
 *
 * 3번은 브라우저가 직접 들고 있지 않다. 사람은 FE 의 /admin 에 비밀번호로 들어가고,
 * FE 서버가 이 토큰을 붙여 대신 호출한다. 토큰이 브라우저로 내려가지 않으므로
 * 토큰이 유출되는 경로가 FE 서버 한 곳으로 좁혀진다.
 */

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** 길이가 달라도 터지지 않고, 맞는 길이에서 조기 반환하지 않는 비교. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * AI 에이전트 — apiKey 로 출전자를 찾는다.
 *
 * 들어온 평문 키를 해시해서 저장된 해시와 맞춰 본다. 반대 방향(저장된 값에서
 * 평문을 얻는 것)은 불가능하다.
 */
export async function authenticateEntrant(req: Request): Promise<Entrant | null> {
  const key = bearer(req);
  if (!key || !looksLikeApiKey(key)) return null;

  const given = hashApiKey(key);
  const data = await readData();
  return data.entrants.find((e) => sameHash(e.apiKeyHash, given)) ?? null;
}

export type AdminCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** 운영자 — 환경변수의 토큰과 맞는지만 본다. */
export function authenticateAdmin(req: Request): AdminCheck {
  const expected = process.env.ADMIN_API_TOKEN?.trim();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "ADMIN_API_TOKEN 이 설정되지 않아 어드민 API 가 꺼져 있습니다.",
    };
  }
  if (expected.length < 16) {
    return {
      ok: false,
      status: 503,
      error: "ADMIN_API_TOKEN 이 너무 짧습니다. 16자 이상으로 다시 설정하세요.",
    };
  }
  if (!sameSecret(bearer(req), expected)) {
    return { ok: false, status: 401, error: "어드민 토큰이 올바르지 않습니다." };
  }
  return { ok: true };
}

/** 워커·크론 — 큐를 비우는 경로에만 쓴다. */
export function authenticateWorker(req: Request): AdminCheck {
  const allowed = [process.env.WORKER_SECRET, process.env.CRON_SECRET]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  if (allowed.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "WORKER_SECRET 또는 CRON_SECRET 이 없어 비활성 상태입니다.",
    };
  }
  const given = bearer(req);
  if (!allowed.some((s) => sameSecret(given, s))) {
    return { ok: false, status: 401, error: "인증 실패" };
  }
  return { ok: true };
}
