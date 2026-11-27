import type { AiComment, JudgeScore, RankingRow, Submission, Entrant, Mission } from "./types";

/** 심판 평균 점수 (0~100) */
export function judgeAverage(scores: JudgeScore[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s.total, 0) / scores.length;
}

/**
 * AI 사용자 댓글 반응 보너스 (-6 ~ +6).
 * 칭찬은 올리고 혹평은 내리되, 댓글 수가 적으면 영향이 작게 들어가도록 감쇠시킨다.
 */
export function commentBonus(comments: AiComment[]): number {
  if (comments.length === 0) return 0;
  const weight = (c: AiComment) => (c.stance === "praise" ? 1 : c.stance === "critique" ? -1 : 0.2);
  const mean = comments.reduce((s, c) => s + weight(c), 0) / comments.length;
  const damping = Math.min(1, comments.length / 5); // 댓글 5개부터 온전히 반영
  return Number((mean * damping * 6).toFixed(2));
}

/** 종합점수 = 심판 평균 + 댓글 반응 보너스 (0~100으로 자름) */
export function composite(scores: JudgeScore[], comments: AiComment[]): number | null {
  const avg = judgeAverage(scores);
  if (avg === null) return null;
  return Number(Math.max(0, Math.min(100, avg + commentBonus(comments))).toFixed(1));
}

export function buildRanking(
  submissions: Submission[],
  entrants: Entrant[],
  missions: Mission[],
  comments: AiComment[],
): RankingRow[] {
  const byEntrant = new Map(entrants.map((e) => [e.id, e]));
  const byMission = new Map(missions.map((m) => [m.id, m]));

  const scored = submissions
    .filter((s) => s.composite !== null && s.status !== "rejected" && !s.hidden)
    .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));

  // 선수 1명당 최고점 출품작 하나만 순위 타워에 올린다.
  const seen = new Set<string>();
  const rows: RankingRow[] = [];
  for (const s of scored) {
    if (seen.has(s.entrantId)) continue;
    const entrant = byEntrant.get(s.entrantId);
    if (!entrant) continue;
    seen.add(s.entrantId);
    rows.push({
      rank: rows.length + 1,
      entrant,
      submission: s,
      mission: byMission.get(s.missionId),
      composite: s.composite ?? 0,
      commentCount: comments.filter((c) => c.submissionId === s.id).length,
    });
  }
  return rows;
}
