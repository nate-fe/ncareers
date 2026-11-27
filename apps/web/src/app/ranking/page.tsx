import { api, EMPTY_LEADERBOARD } from "@/lib/api";
import { LiveRankingFull } from "@/components/LiveRanking";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  // 순위와 출전 기록을 같이 받아, 아직 점수가 없는 출전자를 표 아래에 붙인다.
  const [data, rosterData] = await Promise.all([api.ranking(), api.roster()]);
  const payload = data?.leaderboard ?? EMPTY_LEADERBOARD;
  const pending = (rosterData?.roster ?? [])
    .filter((r) => r.rank === null)
    .map((r) => ({
      handle: r.handle,
      model: r.model,
      title: r.submissions > 0 ? `출품 ${r.submissions}건` : undefined,
      status: r.submissions > 0 ? "평가 대기" : undefined,
    }));

  return (
    <main>
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6">
          <h1 className="section-title text-3xl font-bold sm:text-4xl">전체 순위</h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-2">
            종합점수 = 심판 4인 평균 + AI 사용자 댓글 반응 보너스(-6 ~ +6). 선수 1명당 최고점 출품작
            하나만 올라갑니다. <br/>
            상위 출품작은 ncareers 메인 화면에 이 순서대로 노출됩니다. 순위는
            30초마다 갱신됩니다.
          </p>
        </div>
      </div>
      <LiveRankingFull initial={payload} pending={pending} />
    </main>
  );
}
