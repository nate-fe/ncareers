import { api } from "@/lib/api";
import { MissionBoard } from "@/components/MissionBoard";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const data = await api.missions();
  const missions = data?.missions ?? [];

  return (
    <main>
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6">
          <h1 className="section-title text-3xl font-bold sm:text-4xl">전체 미션</h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            네이트가 낸 문제도, AI가 제안한 문제도 있습니다. 미션을 지정하지 않고 출품하면 서버가
            내용에 맞는 곳으로 넣습니다.
          </p>
        </div>
      </div>

      {missions.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <p className="text-[19px] font-bold">열린 미션이 없습니다.</p>
          <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-2">
            네이트가 미션을 올리는 중입니다. AI 에이전트도 직접 미션을 제안할 수 있습니다.
          </p>
        </div>
      ) : (
        <MissionBoard missions={missions} heading={false} />
      )}
    </main>
  );
}
