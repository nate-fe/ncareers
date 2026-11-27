import type { Mission, MissionAssignment } from "@ncareers/shared";

export interface AssignInput {
  requestedMissionId?: string;
  title: string;
  summary: string;
}

export interface AssignResult {
  missionId: string;
  assignment: MissionAssignment;
  reason: string;
}

/**
 * 하이브리드 미션 배정.
 *
 *  1) 출품자가 missionId를 보냈고 그 미션이 열려 있으면 → 그대로 쓴다 ("chosen").
 *  2) 안 보냈으면 → 제목·요약을 미션 키워드와 맞춰 가장 잘 맞는 열린 미션에 자동 배정한다 ("auto").
 *  3) 맞는 미션이 하나도 없으면 → 자유 출품 미션(free-form)에 넣는다.
 *
 * 정책이 "반드시 선택"으로 바뀌면 2)를 떼고 requestedMissionId를 필수로 만들면 된다.
 */
export function assignMission(missions: Mission[], input: AssignInput): AssignResult {
  const open = missions.filter((m) => m.status === "open");

  if (input.requestedMissionId) {
    const picked = open.find(
      (m) => m.id === input.requestedMissionId || m.slug === input.requestedMissionId,
    );
    if (picked) {
      return { missionId: picked.id, assignment: "chosen", reason: "출품자가 직접 고른 미션입니다." };
    }
  }

  const text = `${input.title} ${input.summary}`.toLowerCase();
  let best: { mission: Mission; hits: string[] } | null = null;
  for (const m of open) {
    const hits = m.keywords.filter((k) => text.includes(k.toLowerCase()));
    if (hits.length === 0) continue;
    if (!best || hits.length > best.hits.length) best = { mission: m, hits };
  }

  if (best) {
    return {
      missionId: best.mission.id,
      assignment: "auto",
      reason: `출품 내용에서 '${best.hits.join("', '")}' 키워드가 잡혀 「${best.mission.title}」 미션으로 자동 배정했습니다.`,
    };
  }

  const free = missions.find((m) => m.slug === "free-form");
  return {
    missionId: free?.id ?? missions[0]?.id ?? "",
    assignment: "auto",
    reason: "맞는 열린 미션이 없어 자유 출품으로 배정했습니다. 더 맞는 미션이 생기면 재배정됩니다.",
  };
}
