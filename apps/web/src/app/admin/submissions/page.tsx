import Link from "next/link";
import { STATUS_LABEL, type AdminSubmissionsPayload } from "@ncareers/shared";
import { AdminApiError, adminFetch } from "@/lib/admin";
import {
  deleteSubmissionAction,
  hideSubmissionAction,
  requeueAction,
  unhideSubmissionAction,
} from "../actions";
import { ActionForm, FormMessage, SubmitButton } from "../forms";
import { Empty, Panel } from "../parts";

export const dynamic = "force-dynamic";

/**
 * 출품작 관리.
 *
 * 기본 동작은 "내리기"다 — 행이 남아 있어 왜 내렸는지 읽을 수 있고 되돌릴 수 있다.
 * 완전 삭제는 따로 두고, 둘 다 이유를 적지 않으면 되지 않는다.
 *
 * 결과 문구는 누른 버튼 바로 위에 뜬다. 목록이 길어서 화면 맨 위에 띄우면
 * 어느 출품작 이야기인지 알 수 없다.
 */
export default async function AdminSubmissions() {
  let rows: AdminSubmissionsPayload["submissions"] = [];
  let error: string | null = null;
  try {
    rows = (await adminFetch<AdminSubmissionsPayload>("/submissions")).submissions;
  } catch (err) {
    error = err instanceof AdminApiError ? err.message : String(err);
  }

  const hiddenCount = rows.filter((s) => s.hidden).length;

  return (
    <>
      {error && (
        <p className="mt-6 border border-point bg-card px-4 py-3 text-[15px] text-point-ink">
          {error}
        </p>
      )}

      <Panel
        title={`출품작 ${rows.length}개`}
        note={
          hiddenCount > 0
            ? `그중 ${hiddenCount}개는 내려져 있어 순위·목록·피드에 보이지 않습니다.`
            : "내린 출품작은 순위·목록·피드에서 빠지지만 기록은 남습니다."
        }
      >
        {rows.length === 0 ? (
          <Empty>아직 출품작이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.id} className={`px-5 py-5 ${s.hidden ? "bg-paper-2" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-paper-2 px-1.5 py-1 text-[12.5px] font-bold text-ink-2">
                    {STATUS_LABEL[s.status]}
                  </span>
                  {s.hidden && (
                    <span className="bg-point px-1.5 py-1 text-[12.5px] font-bold text-on-deep">
                      내려짐
                    </span>
                  )}
                  <span className="text-[12.5px] text-muted">심판 {s.judgeCount}/4</span>
                  <span className="text-[12.5px] text-muted">댓글 {s.commentCount}</span>
                  {s.composite !== null && (
                    <span className="text-[12.5px] font-bold text-ink-2">종합 {s.composite}</span>
                  )}
                  <span className="text-[12.5px] text-muted">
                    {new Date(s.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>

                <h3 className="mt-2.5 text-[17px] font-bold">
                  <Link href={`/submissions/${s.id}`} className="underline-offset-4 hover:underline">
                    {s.title}
                  </Link>
                </h3>
                <p className="mt-1 text-[14.5px] text-muted">
                  {s.entrant} · {s.missionTitle ?? "자유 출품"}
                </p>
                <p className="mt-1 break-all text-[13.5px] text-muted">{s.demoUrl}</p>

                {s.hidden && s.hiddenReason && (
                  <p className="mt-3 border-l-2 border-point pl-3 text-[14.5px] leading-relaxed text-ink-2">
                    내린 이유: {s.hiddenReason}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {s.hidden ? (
                    <ActionForm action={unhideSubmissionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <SubmitButton>되돌리기</SubmitButton>
                      <FormMessage className="mt-2" />
                    </ActionForm>
                  ) : (
                    <ActionForm action={hideSubmissionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block">
                          <span className="block text-[13.5px] font-bold text-muted">
                            내리는 이유
                          </span>
                          <input
                            name="reason"
                            placeholder="예: 데모 링크가 미션과 무관함"
                            className="mt-1 w-64 border border-line-2 bg-paper px-3 py-2 text-[14.5px] outline-none focus:border-brand"
                          />
                        </label>
                      </div>
                      <FormMessage className="mb-2 mt-2" />
                      <div className="mt-2">
                        <SubmitButton tone="danger">내리기</SubmitButton>
                      </div>
                    </ActionForm>
                  )}

                  <ActionForm action={requeueAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton>평가 다시 돌리기</SubmitButton>
                    <FormMessage className="mt-2" />
                  </ActionForm>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-[14px] font-bold text-point-ink">
                    완전히 지우기
                  </summary>
                  <ActionForm action={deleteSubmissionAction} className="mt-3">
                    <input type="hidden" name="id" value={s.id} />
                    <label className="block">
                      <span className="block text-[13.5px] font-bold text-muted">
                        이유 (되돌릴 수 없습니다)
                      </span>
                      <input
                        name="reason"
                        placeholder="예: 타인의 저작물 무단 게시"
                        className="mt-1 w-72 border border-point bg-paper px-3 py-2 text-[14.5px] outline-none"
                      />
                    </label>
                    <FormMessage className="mt-2" />
                    <div className="mt-2">
                      <SubmitButton tone="danger">점수·댓글까지 지우기</SubmitButton>
                    </div>
                  </ActionForm>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                    심판 점수, 상태 기록, 댓글이 함께 사라집니다. 보통은 내리기로 충분합니다.
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
