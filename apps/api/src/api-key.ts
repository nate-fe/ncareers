import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 에이전트 API 키.
 *
 * 두 가지를 지킨다.
 *
 * 1. **추측할 수 없게 만든다.** 예전에는 `Date.now()` 와 `Math.random()` 으로 만들었는데,
 *    Math.random 은 암호용 난수가 아니라 앞뒤 출력으로 내부 상태를 역산할 수 있고
 *    시각 부분은 애초에 추측 가능하다. 지금은 `randomBytes(32)` 를 쓴다.
 *
 * 2. **평문을 저장하지 않는다.** DB 에는 HMAC 해시만 둔다. 저장소가 통째로 새도
 *    그 값으로는 요청을 보낼 수 없다.
 *
 * bcrypt·argon2 를 쓰지 않는 이유:
 *   저 느린 해시들은 **엔트로피가 낮은 비밀번호**를 무차별 대입에서 지키려고 느리다.
 *   여기 키는 서버가 만든 256비트 난수라 무차별 대입이 애초에 불가능하므로 느릴 이유가 없다.
 *   오히려 행마다 소금이 다르면 조회할 때 전 행을 하나씩 대조해야 해서, 요청마다
 *   느린 해시를 수백 번 돌리게 된다. 키에는 서버 비밀값을 섞은 빠른 HMAC 이 맞다.
 */

const PREFIX = "arena_";

/** 개발 편의용 고정값. 운영에서 이걸 쓰면 기동을 막는다. */
const DEV_PEPPER = "ncareers-dev-pepper-not-for-production";

let warned = false;

function pepper(): string {
  const v = process.env.API_KEY_PEPPER?.trim();
  if (v && v.length >= 32) return v;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_KEY_PEPPER 가 없거나 32자 미만입니다. 운영에서는 반드시 설정해야 합니다. " +
        "openssl rand -base64 48 로 만드세요.",
    );
  }
  if (!warned) {
    warned = true;
    console.warn(
      "[api-key] API_KEY_PEPPER 가 없어 개발용 고정값을 씁니다. 운영 배포 전에 반드시 설정하세요.",
    );
  }
  return DEV_PEPPER;
}

/**
 * 새 키. 등록 응답에서 **딱 한 번** 돌려주고 그 뒤로는 어디에도 남지 않는다.
 * 32바이트면 base64url 로 43자다.
 */
export function newApiKey(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

/** 저장·조회에 쓰는 값. 같은 키는 항상 같은 해시가 나오므로 그대로 찾아 쓸 수 있다. */
export function hashApiKey(key: string): string {
  return createHmac("sha256", pepper()).update(key).digest("base64url");
}

/**
 * 해시끼리 비교.
 *
 * 이미 해시라 길이가 늘 같고, 공격자가 맞춰 갈 원문도 없어 타이밍 공격이 성립하기
 * 어렵지만, 비교 한 줄을 안전하게 쓰는 비용이 0 이라 그냥 상수 시간으로 둔다.
 */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** 들어온 Authorization 헤더가 우리 키 모양인지. 모양부터 틀리면 조회할 것도 없다. */
export function looksLikeApiKey(key: string): boolean {
  return key.startsWith(PREFIX) && key.length > PREFIX.length + 20;
}
