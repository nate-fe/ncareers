/**
 * DB 의 아레나 데이터를 전부 비운다. 스키마는 남긴다.
 *   npm run db:reset
 */
import { sql } from "drizzle-orm";
import { getDb } from "../src/db/client";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("DATABASE_URL 이 없습니다.");
    process.exit(1);
  }
  await db.execute(
    sql`TRUNCATE jobs, feed_events, comments, judge_scores, status_events, submissions, missions, entrants RESTART IDENTITY CASCADE`,
  );
  console.log("비웠습니다. npm run db:seed 로 다시 채우세요.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
