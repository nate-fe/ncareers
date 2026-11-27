import type { AdminMissionsPayload } from "@ncareers/shared";
import { AdminApiError, adminFetch } from "@/lib/admin";
import {
  createMissionAction,
  deleteMissionAction,
  editMissionAction,
  toggleMissionAction,
} from "../actions";
import { ActionForm, FormMessage, SubmitButton } from "../forms";
import { Empty, Field, Panel, ServicePicker } from "../parts";

export const dynamic = "force-dynamic";

/**
 * 미션 관리.
 *
 * 여기서 만든 미션은 origin 이 "nate" 로 고정된다 — 네이트가 낸 문제와 AI 가
 * 제안한 문제를 섞지 않기 위해서다. AI 제안 미션은 여기서 닫을 수만 있다.
 *
 * 각 폼은 자기 결과를 자기 안에서 보여 준다. 미션이 여러 개라 화면 맨 위에
 * 한 줄로 띄우면 어느 미션 이야기인지 알 수 없다.
 */
export default async function AdminMissions() {
  let missions: AdminMissionsPayload["missions"] = [];
  let error: string | null = null;
  try {
    missions = (await adminFetch<AdminMissionsPayload>("/missions")).missions;
  } catch (err) {
    error = err instanceof AdminApiError ? err.message : String(err);
  }

  return (
    <>
      {error && (
        <p className="mt-6 border border-point bg-card px-4 py-3 text-[15px] text-point-ink">
          {error}
        </p>
      )}

      <Panel
        title="미션 내기"
        note="심판이 볼 지점으로 쓴 문장은 심판 LLM 프롬프트에 그대로 들어갑니다. 키워드는 미션을 지정하지 않은 출품을 자동 배정할 때 씁니다."
      >
        <ActionForm action={createMissionAction} className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <Field label="제목" name="title" required placeholder="네이트판 글, 어디까지 공개될까?" />
          <ServicePicker />
          <div className="md:col-span-2">
            <Field
              label="설명"
              name="summary"
              required
              textarea
              placeholder="무엇을 만들어야 하는지 두세 문장으로."
            />
          </div>
          <div className="md:col-span-2">
            <Field
              label="심판이 볼 지점"
              name="judgingFocus"
              required
              textarea
              placeholder="이 미션에서 특히 무엇을 엄하게 볼지."
              hint="이 문장이 네 심판의 채점 기준에 그대로 들어갑니다."
            />
          </div>
          <div className="md:col-span-2">
            <Field
              label="키워드"
              name="keywords"
              placeholder="공개, 범위, 익명, 노출"
              hint="쉼표로 구분합니다. 출품 제목·요약에 이 말이 들어가면 이 미션으로 자동 배정됩니다."
            />
          </div>
          <div className="md:col-span-2">
            <FormMessage className="mb-2" />
            <SubmitButton tone="brand">미션 열기</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title={`미션 ${missions.length}개`}>
        {missions.length === 0 ? (
          <Empty>아직 미션이 없습니다. 위에서 하나 내 보세요.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {missions.map((m) => (
              <li key={m.id} className="px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-1.5 py-1 text-[12.5px] font-bold ${
                      m.origin === "nate"
                        ? "bg-point-text text-on-deep"
                        : "border border-point text-point-ink"
                    }`}
                  >
                    {m.origin === "nate" ? "네이트 출제" : "AI 제안"}
                  </span>
                  <span
                    className={`px-1.5 py-1 text-[12.5px] font-bold ${
                      m.status === "open" ? "bg-brand text-on-brand" : "bg-paper-2 text-muted"
                    }`}
                  >
                    {m.status === "open" ? "열림" : "닫힘"}
                  </span>
                  <span className="text-[12.5px] font-bold text-muted">{m.service}</span>
                  <span className="text-[12.5px] text-muted">출품작 {m.submissionCount}개</span>
                </div>

                <h3 className="mt-2.5 text-[17px] font-bold">{m.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{m.summary}</p>

                <details className="mt-3">
                  <summary className="cursor-pointer text-[14.5px] font-bold text-muted">
                    수정
                  </summary>
                  <ActionForm action={editMissionAction} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={m.id} />
                    <Field label="제목" name="title" defaultValue={m.title} required />
                    <ServicePicker defaultValue={m.service} />
                    <div className="md:col-span-2">
                      <Field label="설명" name="summary" defaultValue={m.summary} required textarea />
                    </div>
                    <div className="md:col-span-2">
                      <Field
                        label="심판이 볼 지점"
                        name="judgingFocus"
                        defaultValue={m.judgingFocus}
                        required
                        textarea
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Field label="키워드" name="keywords" defaultValue={m.keywords.join(", ")} />
                    </div>
                    <div className="md:col-span-2">
                      <FormMessage className="mb-2" />
                      <SubmitButton tone="brand">저장</SubmitButton>
                    </div>
                  </ActionForm>
                </details>

                <div className="mt-4 flex flex-wrap items-start gap-2">
                  <ActionForm action={toggleMissionAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value={m.status} />
                    <SubmitButton>{m.status === "open" ? "닫기" : "다시 열기"}</SubmitButton>
                    <FormMessage className="mt-2" />
                  </ActionForm>

                  {m.submissionCount === 0 && (
                    <ActionForm action={deleteMissionAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <SubmitButton tone="danger">지우기</SubmitButton>
                      <FormMessage className="mt-2" />
                    </ActionForm>
                  )}
                </div>

                {m.submissionCount > 0 && (
                  <p className="mt-2 text-[13.5px] text-muted">
                    출품작이 붙어 있어 지울 수 없습니다. 닫기를 쓰세요.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
