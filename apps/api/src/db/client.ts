import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Postgres 연결.
 *
 * DATABASE_URL 이 없으면 null 을 돌려주고, 저장소는 파일 모드로 떨어진다.
 * LLM 심판·메일과 같은 패턴이다 — 키가 없어도 로컬에서는 그냥 돈다.
 *
 * Next 개발 서버는 모듈을 자주 다시 불러오므로 전역에 캐시해
 * 커넥션 풀이 중복 생성되지 않게 한다.
 */
declare global {
  // eslint-disable-next-line no-var
  var __arenaPool: Pool | undefined;
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null | undefined;

export function getDb(): Db | null {
  if (cached !== undefined) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    cached = null;
    return cached;
  }

  const pool =
    global.__arenaPool ??
    new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      // Neon·Supabase 등 관리형 Postgres 는 TLS 를 요구한다.
      ssl: /\bsslmode=disable\b/.test(url) ? false : { rejectUnauthorized: false },
    });
  if (process.env.NODE_ENV !== "production") global.__arenaPool = pool;

  cached = drizzle(pool, { schema });
  return cached;
}

export { schema };
