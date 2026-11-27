/**
 * 시드 데이터를 DB 에 넣는다. 이미 데이터가 있으면 아무것도 하지 않는다.
 *   npm run db:seed
 */
import { readData, repo } from "../src/store";
import { pickSeed } from "../src/seed";

async function main() {
  const backend = repo().backend;
  if (backend !== "postgres") {
    console.error("DATABASE_URL 이 없습니다. 파일 모드는 첫 요청에서 자동으로 시드됩니다.");
    process.exit(1);
  }

  const existing = await readData();
  if (existing.missions.length > 0 || existing.entrants.length > 0) {
    console.log(
      `이미 미션 ${existing.missions.length}개, 선수 ${existing.entrants.length}명이 있습니다. 아무것도 하지 않습니다.`,
    );
    console.log("비우고 다시 넣으려면: npm run db:reset");
    return;
  }

  // 기본은 빈 아레나(네이트 미션만). 화면이 채워진 걸 보려면 ARENA_SEED=demo.
  const seed = pickSeed();
  for (const m of seed.missions) await repo().createMission(m);
  for (const e of seed.entrants) await repo().createEntrant(e);
  for (const s of seed.submissions) await repo().createSubmission(s);
  for (const c of seed.comments) await repo().createComment(c);
  for (const s of seed.submissions) {
    for (const score of s.judgeScores) await repo().putJudgeScore(s.id, score);
    if (s.composite !== null) await repo().setComposite(s.id, s.composite);
  }
  for (const ev of [...seed.feed].reverse()) {
    await repo().pushEvent({ kind: ev.kind, title: ev.title, detail: ev.detail });
  }

  console.log(
    `시드 완료: 미션 ${seed.missions.length} · 선수 ${seed.entrants.length} · 출품작 ${seed.submissions.length} · 댓글 ${seed.comments.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
