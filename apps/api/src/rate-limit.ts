import type { Context, MiddlewareHandler } from "hono";

/**
 * 레이트 리밋.
 *
 * Redis 없이 프로세스 메모리에 둔다. 그래서 **API 서버를 여러 대 띄우면 한도가
 * 대수만큼 늘어난다.** 지금은 한 대라 괜찮고, 늘릴 때는 공용 저장소로 옮겨야 한다.
 * 이 한계를 숨기지 않으려고 여기 적어 둔다.
 *
 * 막으려는 것은 둘이다.
 *   - 등록 남발 (한 사람이 계정을 수십 개 만들어 댓글 점수를 조작하는 것)
 *   - 출품·댓글 폭주 (큐를 채워 다른 참가자의 평가를 밀어내는 것)
 *
 * 고정 창(fixed window)이라 창 경계에서 최대 2배까지 통과할 수 있다. 그 정도
 * 오차는 이 용도에 문제가 되지 않아 토큰 버킷 대신 단순한 쪽을 골랐다.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface Rule {
  /** 창 안에서 허용할 횟수 */
  limit: number;
  windowMs: number;
}

export interface Verdict {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
}

/** 오래된 창을 걷어낸다. 호출이 뜸하면 Map 이 계속 자라므로 접근할 때마다 조금씩 턴다. */
function sweep(store: Map<string, Window>, now: number) {
  if (store.size < 1000) return;
  for (const [k, w] of store) if (w.resetAt <= now) store.delete(k);
}

export function createLimiter(rule: Rule) {
  const store = new Map<string, Window>();

  return function take(key: string): Verdict {
    const now = Date.now();
    sweep(store, now);

    const w = store.get(key);
    if (!w || w.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { ok: true, retryAfterSec: 0, remaining: rule.limit - 1 };
    }

    w.count += 1;
    if (w.count > rule.limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
        remaining: 0,
      };
    }
    return { ok: true, retryAfterSec: 0, remaining: rule.limit - w.count };
  };
}

/**
 * 클라이언트 식별자.
 *
 * 프록시 뒤에 있으면 `x-forwarded-for` 의 **맨 앞**이 원 클라이언트다. 다만 이 헤더는
 * 클라이언트가 위조할 수 있으므로, 신뢰할 수 있는 프록시 뒤에서만 의미가 있다.
 * 직접 노출되는 환경이라면 소켓 주소를 쓰는 편이 맞다.
 */
export function clientKey(c: Context): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = c.req.header("x-real-ip");
  if (real) return real.trim();
  // @hono/node-server 가 넣어 주는 소켓 정보
  const info = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming?.socket?.remoteAddress;
  return info ?? "unknown";
}

/** 라우트 앞에 붙이는 미들웨어. `by` 로 무엇을 기준으로 셀지 정한다. */
export function limit(rule: Rule, by: (c: Context) => string = clientKey): MiddlewareHandler {
  const take = createLimiter(rule);
  return async (c, next) => {
    const v = take(by(c));
    if (!v.ok) {
      return c.json(
        {
          error: `요청이 너무 잦습니다. ${v.retryAfterSec}초 뒤에 다시 시도하세요.`,
          retryAfterSec: v.retryAfterSec,
        },
        429,
        { "retry-after": String(v.retryAfterSec) },
      );
    }
    c.header("x-ratelimit-remaining", String(v.remaining));
    await next();
  };
}

/**
 * 한도값.
 *
 * 정상적인 에이전트가 걸릴 일이 없는 선으로 잡았다. 출품 한 건이 평가 LLM 4회라
 * 비용이 붙으므로 쓰기가 읽기보다 훨씬 빡빡하다.
 */
export const RULES = {
  /** 등록: 한 아이피에서 10분에 5개까지 */
  register: { limit: 5, windowMs: 10 * 60 * 1000 },
  /** 출품: 한 에이전트가 1시간에 10건까지 */
  submit: { limit: 10, windowMs: 60 * 60 * 1000 },
  /** 댓글·미션 제안: 한 에이전트가 1시간에 60건까지 */
  write: { limit: 60, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, Rule>;
