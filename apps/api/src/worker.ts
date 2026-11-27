/**
 * 평가 워커.
 *
 * API 는 출품을 받으면 jobs 에 한 줄 넣고 바로 201 을 돌려준다.
 * 실제 평가(LLM 네 번 + 메일 열 통, 30초 이상)는 이 상시 프로세스가 집어 간다.
 *
 *   npm run worker
 *
 * 여러 개 띄워도 된다. Postgres 백엔드는 FOR UPDATE SKIP LOCKED 로 같은 작업을
 * 두 번 집지 않는다. 파일 백엔드에서는 반드시 하나만 띄워야 한다.
 */
import { repo } from "./store";
import { runEvaluation } from "./pipeline";
import { MAX_JOB_ATTEMPTS } from "./repo";

const IDLE_MS = Number(process.env.WORKER_IDLE_MS || 2000);
/** 1 이면 큐가 비는 순간 종료한다. 테스트와 cron 방식 배포에 쓴다. */
const ONCE = process.env.WORKER_ONCE === "1";

let stopping = false;

function log(...args: unknown[]) {
  console.log(`[worker ${new Date().toISOString()}]`, ...args);
}

async function tick(): Promise<boolean> {
  const job = await repo().claimJob();
  if (!job) return false;

  log(`작업 ${job.id} 시작 — ${job.kind} ${job.submissionId} (시도 ${job.attempts}/${MAX_JOB_ATTEMPTS})`);
  const started = Date.now();
  try {
    await runEvaluation(job.submissionId);
    await repo().finishJob(job.id);
    log(`작업 ${job.id} 완료 (${((Date.now() - started) / 1000).toFixed(1)}초)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo().finishJob(job.id, message);
    log(`작업 ${job.id} 실패: ${message}`);
  }
  return true;
}

async function main() {
  log(`시작. 저장소: ${repo().backend}`);
  if (repo().backend === "file") {
    log("경고: 파일 모드입니다. 웹 서버와 동시에 쓰면 서로의 변경을 덮어씁니다.");
    log("      DATABASE_URL 을 설정해 Postgres 로 돌리는 것을 권합니다.");
  }

  while (!stopping) {
    let worked = false;
    try {
      worked = await tick();
    } catch (err) {
      // 큐 조회 자체가 실패한 경우(DB 끊김 등). 쉬었다가 다시 시도한다.
      log("큐 조회 실패:", err);
    }
    if (!worked) {
      if (ONCE) {
        log("큐가 비었습니다. WORKER_ONCE=1 이라 종료합니다.");
        break;
      }
      if (!stopping) await new Promise((r) => setTimeout(r, IDLE_MS));
    }
  }
  log("종료합니다.");
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (stopping) process.exit(1); // 두 번 누르면 즉시
    log(`${sig} 수신. 진행 중인 작업을 끝내고 멈춥니다. (한 번 더 누르면 즉시 종료)`);
    stopping = true;
  });
}

main().catch((err) => {
  console.error("[worker] 치명적 오류:", err);
  process.exit(1);
});
