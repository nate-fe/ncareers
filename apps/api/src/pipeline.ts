import { readData, repo } from "./store";
import { runJudge, JUDGE_ORDER, JUDGES } from "./judges";
import { composite, buildRanking } from "@ncareers/shared";
import { sendMail } from "./mail";
import { finalScoreMail, judgeArrivedMail, statusMail } from "./mail/templates";
import type { ArenaData, JudgeScore, Submission, SubmissionStatus } from "@ncareers/shared";

/**
 * 상태를 한 칸 옮기고, 그때마다 출품자에게 메일을 보낸다.
 * "평가가 진행될 때마다 메일링" 요구가 여기 한 곳으로 모여 있다.
 */
async function transition(
  submission: Submission,
  entrantEmail: string | undefined,
  status: SubmissionStatus,
  note: string,
): Promise<void> {
  const at = new Date().toISOString();

  let mailed = false;
  if (entrantEmail) {
    const msg = statusMail({ ...submission, status }, status, note);
    msg.to = entrantEmail;
    const res = await sendMail(msg);
    mailed = res.delivered || res.via === "console";
  }

  await repo().advanceStatus(submission.id, status, { status, note, at, mailed });
  await repo().pushEvent({ kind: "status", title: submission.title, detail: note });

  // 호출한 쪽이 들고 있는 사본도 맞춰 둔다
  submission.status = status;
  submission.updatedAt = at;
  submission.statusHistory = [...submission.statusHistory, { status, note, at, mailed }];
}

/** 데모 링크가 실제로 열리는지 가볍게 확인한다. */
async function verifyDemo(url: string): Promise<{ ok: boolean; note: string }> {
  if (!url) return { ok: false, note: "데모 링크가 없습니다. 열어 볼 수 있는 결과물이 있어야 합니다." };
  if (process.env.ARENA_SKIP_VERIFY === "1") {
    return { ok: true, note: "검증 생략 설정으로 통과 처리했습니다." };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return { ok: true, note: `데모 링크 응답 ${res.status}. 검증 통과.` };
    return { ok: true, note: `데모 링크가 ${res.status}를 반환했지만 접근은 됩니다. 심판 평가로 넘깁니다.` };
  } catch {
    // 데모 서버가 HEAD 를 막아 두는 경우가 흔해서, 도달 실패만으로 탈락시키지 않는다.
    return { ok: true, note: "데모 링크 응답을 확인하지 못했습니다. 심판이 직접 확인합니다." };
  }
}

function lookup(data: ArenaData, submissionId: string) {
  const submission = data.submissions.find((s) => s.id === submissionId);
  if (!submission) return null;
  return {
    submission,
    entrant: data.entrants.find((e) => e.id === submission.entrantId),
    mission: data.missions.find((m) => m.id === submission.missionId),
  };
}

/**
 * 출품작 하나의 전체 평가 흐름.
 *   검증 → 심판 4인 평가(도착할 때마다 메일) → 점수 확정 → 랭킹 반영
 *
 * 워커가 호출한다. 요청 핸들러에서 직접 부르지 않는다 — LLM 네 번에 메일 열 통이라
 * 응답 시간 안에 끝나지 않고, 서버리스에서는 응답과 동시에 중단된다.
 */
export async function runEvaluation(submissionId: string): Promise<void> {
  const found = lookup(await readData(), submissionId);
  if (!found) throw new Error(`출품작을 찾을 수 없습니다: ${submissionId}`);
  const { submission, entrant, mission } = found;

  // 1) 검증
  await transition(submission, entrant?.email, "verifying", "데모 링크를 확인하고 있습니다.");
  const verdict = await verifyDemo(submission.demoUrl);
  if (!verdict.ok) {
    await transition(submission, entrant?.email, "rejected", verdict.note);
    return;
  }
  await transition(submission, entrant?.email, "verified", verdict.note);
  await transition(
    submission,
    entrant?.email,
    "judging",
    "네 심판(GPT · Claude · Gemini · Grok)에게 평가를 요청했습니다.",
  );

  // 2) 심판 4인 — 병렬로 돌리되, 도착하는 순서대로 저장하고 그때마다 메일을 보낸다.
  const snapshot: Submission = { ...submission };
  await Promise.all(
    JUDGE_ORDER.map(async (judgeId) => {
      let score: JudgeScore;
      try {
        score = await runJudge(judgeId, snapshot, mission);
      } catch (err) {
        console.error(`[pipeline] 심판 ${judgeId} 실패:`, err);
        return;
      }

      await repo().putJudgeScore(submissionId, score);
      await repo().pushEvent({
        kind: "judge",
        title: JUDGES[judgeId].name,
        detail: `${submission.title} — ${score.total}점${score.mocked ? " (모의)" : ""}`,
      });

      if (entrant) {
        const fresh = lookup(await readData(), submissionId);
        const msg = judgeArrivedMail(fresh?.submission ?? submission, score);
        msg.to = entrant.email;
        await sendMail(msg);
      }
    }),
  );

  // 3) 점수 확정 + 랭킹 반영
  const data = await readData();
  const after = lookup(data, submissionId);
  if (!after) return;

  const subComments = data.comments.filter((c) => c.submissionId === submissionId);
  const score = composite(after.submission.judgeScores, subComments);
  await repo().setComposite(submissionId, score);
  after.submission.composite = score;

  await transition(
    after.submission,
    entrant?.email,
    "scored",
    `네 심판 평가 완료. 종합 ${score}점으로 확정되었습니다.`,
  );

  const ranked = await readData();
  const rank =
    buildRanking(ranked.submissions, ranked.entrants, ranked.missions, ranked.comments).find(
      (r) => r.submission.id === submissionId,
    )?.rank ?? null;

  // 심판별 점수를 모은 요약 메일. "랭킹 반영" 알림보다 먼저 가야 순서가 읽힌다.
  if (entrant) {
    const msg = finalScoreMail(after.submission, rank);
    msg.to = entrant.email;
    await sendMail(msg);
  }

  await transition(
    after.submission,
    entrant?.email,
    "ranked",
    rank ? `순위 타워 ${rank}위로 반영되었습니다.` : "순위 타워에 반영되었습니다.",
  );
  await repo().pushEvent({
    kind: "score",
    title: after.submission.title,
    detail: `종합 ${score}점 확정`,
  });
}

/** 댓글이 붙으면 반응 보너스가 바뀌므로 종합점수를 다시 계산한다. */
export async function recomputeComposite(submissionId: string): Promise<number | null> {
  const data = await readData();
  const sub = data.submissions.find((s) => s.id === submissionId);
  if (!sub || sub.judgeScores.length === 0) return null;

  const score = composite(
    sub.judgeScores,
    data.comments.filter((c) => c.submissionId === submissionId),
  );
  await repo().setComposite(submissionId, score);
  return score;
}
