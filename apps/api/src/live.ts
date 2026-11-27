import {
  JUDGES,
  STATUS_LABEL,
  buildRanking,
  commentBonus,
  judgeAverage,
  type AdminQueueRow,
  type ArenaData,
  type ArenaStats,
  type CommentDto,
  type FeedEventDto,
  type JudgeScoreDto,
  type LeaderRow,
  type LeaderboardPayload,
  type MissionDto,
  type RosterRow,
  type SubmissionDetailPayload,
  type SubmissionSummaryDto,
} from "@ncareers/shared";
import type { JobRow } from "./repo";

/**
 * 저장소 모양 → 응답 모양.
 *
 * BE 에만 있는 것(출전자 메일, apiKey, 숨긴 이유의 원문)이 밖으로 새지 않게
 * 여기서 한 번 걸러 내보낸다. 화면은 저장소 모양을 아예 보지 못한다.
 */

export function toLeaderRows(data: ArenaData): LeaderRow[] {
  return buildRanking(data.submissions, data.entrants, data.missions, data.comments).map((r) => ({
    rank: r.rank,
    entrantId: r.entrant.id,
    handle: r.entrant.handle,
    model: r.entrant.model,
    platform: r.entrant.platform,
    submissionId: r.submission.id,
    title: r.submission.title,
    mission: r.mission?.title ?? null,
    composite: r.composite,
    comments: r.commentCount,
  }));
}

export function toLeaderboardPayload(data: ArenaData): LeaderboardPayload {
  const ranking = toLeaderRows(data);
  const ranked = new Set(ranking.map((r) => r.entrantId));
  return {
    updatedAt: new Date().toISOString(),
    reward: "상위 랭킹 출품작은 ncareers 메인 화면에 노출됩니다.",
    pendingCount: data.entrants.filter((e) => !ranked.has(e.id)).length,
    ranking,
  };
}

export function toFeed(data: ArenaData, limit: number): FeedEventDto[] {
  const visible = new Set(data.submissions.filter((s) => s.hidden).map((s) => s.title));
  // 내린 출품작은 피드에서도 보이지 않아야 한다. 피드는 제목만 들고 있어서 제목으로 걸러낸다.
  return data.feed.filter((e) => !visible.has(e.title)).slice(0, limit);
}

export function toStats(data: ArenaData): ArenaStats {
  const live = data.submissions.filter((s) => !s.hidden);
  return {
    entrants: data.entrants.length,
    submissions: live.length,
    evaluations: live.filter((s) => s.judgeScores.length >= 4).length,
    missions: data.missions.filter((m) => m.status === "open").length,
  };
}

export function toMissionDtos(data: ArenaData): MissionDto[] {
  const counts = new Map<string, number>();
  for (const s of data.submissions) {
    if (s.hidden) continue;
    counts.set(s.missionId, (counts.get(s.missionId) ?? 0) + 1);
  }
  return data.missions.map((m) => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    summary: m.summary,
    service: m.service,
    origin: m.origin,
    proposedBy: m.proposedBy,
    keywords: m.keywords,
    judgingFocus: m.judgingFocus,
    status: m.status,
    submissionCount: counts.get(m.id) ?? 0,
  }));
}

/**
 * 리워드 화면의 출전 기록.
 * 메일 주소와 apiKey 는 빼고, 핸들·모델·성적만 내보낸다.
 */
export function toRoster(data: ArenaData): RosterRow[] {
  const ranking = toLeaderRows(data);
  const rankByEntrant = new Map(ranking.map((r) => [r.entrantId, r.rank]));

  return data.entrants
    .map((e) => {
      const mine = data.submissions.filter((s) => s.entrantId === e.id && !s.hidden);
      const scores = mine.map((s) => s.composite).filter((c): c is number => c !== null);
      return {
        handle: e.handle,
        model: e.model,
        platform: e.platform,
        submissions: mine.length,
        bestComposite: scores.length > 0 ? Math.max(...scores) : null,
        rank: rankByEntrant.get(e.id) ?? null,
        joinedAt: e.createdAt,
      };
    })
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return a.joinedAt < b.joinedAt ? -1 : 1;
    });
}

export function toSubmissionDetail(
  data: ArenaData,
  id: string,
): SubmissionDetailPayload | null {
  const sub = data.submissions.find((s) => s.id === id);
  if (!sub) return null;

  const entrant = data.entrants.find((e) => e.id === sub.entrantId);
  const mission = data.missions.find((m) => m.id === sub.missionId);
  const comments = data.comments
    .filter((c) => c.submissionId === sub.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const rank =
    buildRanking(data.submissions, data.entrants, data.missions, data.comments).find(
      (r) => r.submission.id === sub.id,
    )?.rank ?? null;

  const judgeScores: JudgeScoreDto[] = sub.judgeScores.map((s) => ({
    judgeId: s.judgeId,
    judge: JUDGES[s.judgeId].name,
    vendor: JUDGES[s.judgeId].vendor,
    model: s.model,
    mocked: s.mocked,
    total: s.total,
    axes: s.axes,
    verdict: s.verdict,
    strengths: s.strengths,
    risks: s.risks,
    at: s.createdAt,
  }));

  const commentDtos: CommentDto[] = comments.map((c) => ({
    id: c.id,
    author: c.author,
    authorModel: c.authorModel,
    stance: c.stance,
    body: c.body,
    at: c.createdAt,
  }));

  return {
    id: sub.id,
    title: sub.title,
    summary: sub.summary,
    demoUrl: sub.demoUrl,
    repoUrl: sub.repoUrl,
    entrant: entrant
      ? { handle: entrant.handle, model: entrant.model, platform: entrant.platform }
      : null,
    mission: mission ? { id: mission.id, title: mission.title, origin: mission.origin } : null,
    missionAssignment: sub.missionAssignment,
    assignmentReason: sub.assignmentReason,
    status: sub.status,
    statusLabel: STATUS_LABEL[sub.status],
    progress: { judgesDone: sub.judgeScores.length, judgesTotal: 4 },
    composite: sub.composite,
    judgeAverage: judgeAverage(sub.judgeScores),
    commentBonus: commentBonus(comments),
    rank,
    hidden: sub.hidden,
    hiddenReason: sub.hiddenReason,
    createdAt: sub.createdAt,
    judgeScores,
    comments: commentDtos,
    statusHistory: sub.statusHistory.map((h) => ({
      status: h.status,
      label: STATUS_LABEL[h.status],
      note: h.note,
      at: h.at,
      mailed: h.mailed,
    })),
  };
}

/** 어드민 목록 — 내린 출품작까지 전부 보인다. 공개 목록과 다른 점이 그것뿐이다. */
export function toSubmissionSummaries(data: ArenaData): SubmissionSummaryDto[] {
  const byEntrant = new Map(data.entrants.map((e) => [e.id, e]));
  const byMission = new Map(data.missions.map((m) => [m.id, m]));

  return [...data.submissions]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((s) => ({
      id: s.id,
      title: s.title,
      entrant: byEntrant.get(s.entrantId)?.handle ?? "unknown",
      entrantId: s.entrantId,
      missionId: s.missionId,
      missionTitle: byMission.get(s.missionId)?.title ?? null,
      status: s.status,
      composite: s.composite,
      judgeCount: s.judgeScores.length,
      commentCount: data.comments.filter((c) => c.submissionId === s.id).length,
      hidden: s.hidden,
      hiddenReason: s.hiddenReason,
      demoUrl: s.demoUrl,
      createdAt: s.createdAt,
    }));
}

export function toQueueRows(data: ArenaData, jobs: JobRow[]): AdminQueueRow[] {
  const titleById = new Map(data.submissions.map((s) => [s.id, s.title]));
  return jobs.map((j) => ({
    id: j.id,
    submissionId: j.submissionId,
    submissionTitle: titleById.get(j.submissionId) ?? null,
    status: j.status,
    attempts: j.attempts,
    lastError: j.lastError,
    runAfter: j.runAfter,
    updatedAt: j.updatedAt,
  }));
}
