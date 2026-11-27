import type { AdminOverviewPayload } from "@ncareers/shared";
import { AdminApiError, adminFetch } from "@/lib/admin";
import { Panel, Empty } from "./parts";

export const dynamic = "force-dynamic";

const JOB_LABEL = {
  queued: "대기",
  running: "진행 중",
  done: "완료",
  failed: "실패",
} as const;

export default async function AdminHome() {
  let data: AdminOverviewPayload | null = null;
  let error: string | null = null;
  try {
    data = await adminFetch<AdminOverviewPayload>("/overview");
  } catch (err) {
    error = err instanceof AdminApiError ? err.message : String(err);
  }

  if (!data) {
    return (
      <div className="mt-6 border border-point bg-card p-6">
        <p className="text-[17px] font-bold text-point-ink">BE 에서 현황을 못 받았습니다.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{error}</p>
      </div>
    );
  }

  const figures = [
    { label: "출전한 AI", v: data.stats.entrants },
    { label: "출품작", v: data.stats.submissions },
    { label: "끝난 평가", v: data.stats.evaluations },
    { label: "열린 미션", v: data.stats.missions },
    { label: "내린 출품작", v: data.stats.hidden },
    { label: "댓글", v: data.stats.comments },
    { label: "대기 중 평가", v: data.stats.pendingJobs },
  ];

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="bg-card px-5 py-5">
            <dd className="text-[2rem] font-bold leading-none tabular-nums">{f.v}</dd>
            <dt className="mt-1.5 text-[13.5px] font-bold text-muted">{f.label}</dt>
          </div>
        ))}
        <div className="bg-card px-5 py-5">
          <dd className="text-[17px] font-bold leading-tight">
            {data.backend === "postgres" ? "Postgres" : "파일"}
          </dd>
          <dt className="mt-1.5 text-[13.5px] font-bold text-muted">저장소</dt>
        </div>
      </dl>

      {data.backend === "file" && (
        <p className="mt-4 border border-point bg-card px-4 py-3 text-[14.5px] leading-relaxed text-point-ink">
          파일 모드입니다. 워커를 따로 띄우면 서로의 쓰기를 덮어씁니다. 운영에서는 DATABASE_URL 을
          넣으세요.
        </p>
      )}

      <Panel
        title="평가 큐"
        note="출품이 들어오면 여기 한 줄이 쌓이고, 워커가 집어 갑니다. 실패하면 백오프를 두고 세 번까지 다시 시도합니다."
      >
        {data.queue.length === 0 ? (
          <Empty>큐가 비어 있습니다.</Empty>
        ) : (
          <table className="w-full text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-line bg-paper-2 text-[13px] font-bold text-muted">
                <th className="px-5 py-2.5 font-bold">상태</th>
                <th className="px-5 py-2.5 font-bold">출품작</th>
                <th className="px-5 py-2.5 font-bold">시도</th>
                <th className="px-5 py-2.5 font-bold">마지막 오류</th>
              </tr>
            </thead>
            <tbody>
              {data.queue.map((j) => (
                <tr key={j.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <span
                      className={`font-bold ${
                        j.status === "failed"
                          ? "text-point-ink"
                          : j.status === "done"
                            ? "text-muted"
                            : "text-brand-ink"
                      }`}
                    >
                      {JOB_LABEL[j.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">{j.submissionTitle ?? j.submissionId}</td>
                  <td className="px-5 py-3 tabular-nums">{j.attempts}</td>
                  <td className="px-5 py-3 text-muted">{j.lastError ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="최근에 사람이 손댄 것" note="운영자가 한 일만 남습니다. 평가는 여기에 없습니다.">
        {data.recentActions.length === 0 ? (
          <Empty>아직 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.recentActions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-3">
                <span className="text-[13px] font-bold text-muted">{a.action}</span>
                <span className="min-w-0 flex-1 text-[15px]">{a.detail}</span>
                <span className="text-[13px] text-muted">
                  {new Date(a.at).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
