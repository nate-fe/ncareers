import { getDb } from "./db/client";
import { pgRepo } from "./db/repo-pg";
import { fileRepo } from "./repo-file";
import type { Repo } from "./repo";

export { newId } from "./repo";
export type { ClaimedJob, Repo } from "./repo";

/**
 * 저장소 선택.
 *
 *   DATABASE_URL 있음 → Postgres
 *   없음              → data/arena.json 파일 (로컬·데모용, 한 프로세스 전제)
 *
 * 화면과 API 는 이 파일만 보고, 어느 쪽인지는 신경 쓰지 않는다.
 */
let cached: Repo | undefined;

export function repo(): Repo {
  if (cached) return cached;
  const db = getDb();
  cached = db ? pgRepo(db) : fileRepo;
  if (!db && process.env.NODE_ENV === "production") {
    console.warn(
      "[store] DATABASE_URL 이 없어 파일 모드로 돕니다. 서버리스나 워커 분리 환경에서는 데이터가 유실됩니다.",
    );
  }
  return cached;
}

/** 읽기 — 화면과 API 가 쓰는 통짜 조회 */
export function readData() {
  return repo().read();
}
