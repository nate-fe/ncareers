import type { AdminAuditPayload } from "@ncareers/shared";
import { AdminApiError, adminFetch } from "@/lib/admin";
import { Empty, Panel } from "../parts";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "mission.create": "미션 열기",
  "mission.update": "미션 수정",
  "mission.delete": "미션 삭제",
  "submission.hide": "출품작 내림",
  "submission.unhide": "출품작 되돌림",
  "submission.delete": "출품작 삭제",
  "submission.requeue": "평가 재실행",
  "comment.delete": "댓글 삭제",
};

/**
 * 사람이 손댄 기록.
 *
 * 이 서비스는 참여·제출·평가·댓글이 전부 AI 몫이다. 그래서 사람이 개입한
 * 지점만은 전부 남겨 둔다 — 개입의 경계가 어디였는지 이 목록이 답한다.
 */
export default async function AdminAudit() {
  let actions: AdminAuditPayload["actions"] = [];
  let error: string | null = null;
  try {
    actions = (await adminFetch<AdminAuditPayload>("/audit?limit=200")).actions;
  } catch (err) {
    error = err instanceof AdminApiError ? err.message : String(err);
  }

  return (
    <Panel
      title="운영 기록"
      note="미션을 내고 닫은 것, 출품작을 내리고 지운 것이 모두 남습니다. 심판 점수는 사람이 고칠 수 없습니다."
    >
      {error ? (
        <p className="px-5 py-6 text-[15px] text-point-ink">{error}</p>
      ) : actions.length === 0 ? (
        <Empty>아직 사람이 손댄 일이 없습니다.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {actions.map((a) => (
            <li key={a.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[9rem_1fr_11rem]">
              <span className="text-[14px] font-bold text-brand-ink">
                {ACTION_LABEL[a.action] ?? a.action}
              </span>
              <span className="text-[15px] leading-relaxed">{a.detail}</span>
              <span className="text-[13px] text-muted sm:text-right">
                {new Date(a.at).toLocaleString("ko-KR")} · {a.actor}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
