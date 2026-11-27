import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { API_BASE } from "./api";

/**
 * 어드민 로그인과 어드민 API 호출.
 *
 * 왜 두 단계인가:
 *   브라우저 ──비밀번호──▶ FE 서버 ──ADMIN_API_TOKEN──▶ BE
 *
 * BE 의 어드민 토큰이 브라우저로 내려가지 않는다. 브라우저가 들고 있는 건
 * HttpOnly 세션 쿠키 하나뿐이고, 그 쿠키로는 BE 를 직접 부를 수 없다.
 * 토큰이 새어 나갈 수 있는 자리가 FE 서버 한 곳으로 좁혀진다.
 *
 * 운영자가 한 명이라 사용자 표를 두지 않았다. 사람이 늘면 이 파일이 바뀌는
 * 자리고, BE 는 그대로다 — BE 는 "맞는 토큰인지"만 보기 때문에.
 */
const COOKIE = "ncareers_admin";
const MAX_AGE_SEC = 60 * 60 * 8; // 8시간

function password(): string | null {
  const v = process.env.ADMIN_PASSWORD?.trim();
  return v && v.length >= 8 ? v : null;
}

/** 쿠키 서명 키. 따로 주지 않으면 비밀번호에서 뽑는다 (비밀번호를 바꾸면 세션이 끊긴다). */
function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || `fallback:${password() ?? ""}`;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * 로그인 시도 제한.
 *
 * 비밀번호 하나로 들어오는 화면이라 무차별 대입을 막아야 한다. 프로세스 메모리에
 * 두므로 FE 인스턴스가 여러 개면 한도가 그만큼 늘어나고, 재배포하면 초기화된다.
 * 지금 규모에서는 충분하고, 더 필요해지면 BE 쪽 공용 저장소로 옮겨야 한다.
 */
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

async function attemptKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

function tooMany(key: string): boolean {
  const now = Date.now();
  if (attempts.size > 500) {
    for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  }
  const w = attempts.get(key);
  if (!w || w.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  w.count += 1;
  return w.count > ATTEMPT_LIMIT;
}

export type AdminSetup =
  | { ready: true }
  | { ready: false; reason: string };

/** 어드민을 쓸 수 있는 상태인지. 못 쓰면 화면이 무엇을 설정해야 하는지 알려준다. */
export function adminSetup(): AdminSetup {
  if (!password()) {
    return {
      ready: false,
      reason: "ADMIN_PASSWORD 가 없거나 8자 미만입니다. .env.local 에 설정하세요.",
    };
  }
  if (!process.env.ADMIN_API_TOKEN?.trim()) {
    return { ready: false, reason: "ADMIN_API_TOKEN 이 없습니다. BE 와 같은 값을 넣으세요." };
  }
  return { ready: true };
}

export type SignInResult = "ok" | "bad-password" | "too-many";

/** 비밀번호 확인 → 세션 쿠키 발급. */
export async function signIn(given: string): Promise<SignInResult> {
  if (tooMany(await attemptKey())) return "too-many";

  const expected = password();
  if (!expected || !safeEqual(given, expected)) return "bad-password";

  const expires = Date.now() + MAX_AGE_SEC * 1000;
  const payload = `${expires}.${randomBytes(8).toString("hex")}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: MAX_AGE_SEC,
  });
  return "ok";
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: "/admin" });
}

export async function isSignedIn(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;

  const cut = raw.lastIndexOf(".");
  if (cut < 0) return false;
  const payload = raw.slice(0, cut);
  const mac = raw.slice(cut + 1);
  if (!safeEqual(mac, sign(payload))) return false;

  const expires = Number(payload.split(".")[0]);
  return Number.isFinite(expires) && expires > Date.now();
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * BE 의 /api/admin/* 호출. 토큰은 여기서만 붙는다.
 * 로그인 확인은 호출하는 쪽(레이아웃과 서버 액션)이 먼저 한다.
 */
export async function adminFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = process.env.ADMIN_API_TOKEN?.trim();
  if (!token) throw new AdminApiError(503, "ADMIN_API_TOKEN 이 설정되지 않았습니다.");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/admin${path}`, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    throw new AdminApiError(0, `BE(${API_BASE}) 에 연결하지 못했습니다: ${String(err)}`);
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `${path} → ${res.status}`;
    throw new AdminApiError(res.status, message);
  }
  return data as T;
}
