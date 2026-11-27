// 저장소를 시드 상태로 되돌린다. 서버가 다음 요청에서 자동으로 다시 시드한다.
import { rm } from "node:fs/promises";
import path from "node:path";

const dir = process.env.ARENA_DATA_DIR || path.join(process.cwd(), "data");
for (const f of ["arena.json", "outbox.json"]) {
  await rm(path.join(dir, f), { force: true });
  console.log(`removed ${path.join(dir, f)}`);
}
console.log("다음 요청에서 시드 데이터로 다시 채워집니다.");
