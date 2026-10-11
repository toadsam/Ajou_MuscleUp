import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { crewApi } from "../services/crewApi";
import type { CrewDetail } from "../types/crew";
import { useCountUp } from "../hooks/useCountUp";

function CountNumber({ value }: { value: number }) {
  const v = useCountUp(value, { duration: 900 });
  const digits = Number.isInteger(value) ? 0 : Math.min(2, String(value).split(".")[1]?.length ?? 0);
  return <>{v.toFixed(digits)}</>;
}

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function CrewHighlights() {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const crewIdNum = Number(crewId || 0);

  const [month, setMonth] = useState(currentMonthKey());
  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!crewIdNum || Number.isNaN(crewIdNum)) {
      navigate("/crew", { replace: true });
      return;
    }
    void crewApi
      .getDetail(crewIdNum, month)
      .then((data) => setDetail(data))
      .catch((e: any) => setError(e?.response?.data?.message || "하이라이트를 불러오지 못했습니다."));
  }, [crewIdNum, month]);

  const highlights = useMemo(() => {
    if (!detail) return null;
    const mvp = detail.competitionBoard[0];
    const growth = [...detail.competitionBoard].sort((a, b) => b.recentScore - a.recentScore)[0];
    const challenger = [...detail.competitionBoard].sort((a, b) => b.challengeAverageCompletion - a.challengeAverageCompletion)[0];
    const activeChallenge = detail.challenges.find((c) => c.status === "ONGOING") ?? detail.challenges[0] ?? null;
    const challengeLeader = activeChallenge?.members?.[0] ?? null;
    return { mvp, growth, challenger, activeChallenge, challengeLeader };
  }, [detail]);

  const cards = [
    {
      key: "mvp",
      label: "MVP",
      plate: "bg-plate-yellow text-black",
      name: highlights?.mvp?.nickname ?? "-",
      big: true,
      sub: (
        <>
          총점 <CountNumber value={highlights?.mvp?.score ?? 0} />
        </>
      ),
    },
    {
      key: "growth",
      label: "성장왕",
      plate: "bg-plate-green text-white",
      name: highlights?.growth?.nickname ?? "-",
      big: true,
      sub: (
        <>
          최근 점수 <CountNumber value={highlights?.growth?.recentScore ?? 0} />
        </>
      ),
    },
    {
      key: "challenger",
      label: "도전왕",
      plate: "bg-plate-blue text-white",
      name: highlights?.challenger?.nickname ?? "-",
      big: true,
      sub: (
        <>
          평균 완료율 <CountNumber value={Math.round(highlights?.challenger?.challengeAverageCompletion ?? 0)} />%
        </>
      ),
    },
    {
      key: "hot",
      label: "HOT 챌린지",
      plate: "bg-plate-red text-white",
      name: highlights?.activeChallenge?.title ?? "-",
      big: false,
      sub: <>리더 {highlights?.challengeLeader?.nickname ?? "-"}</>,
    },
  ];

  return (
    <section className="relative min-h-screen overflow-hidden pb-20 pt-24 text-white">
      <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6 lg:px-8">
        <header className="dg-steel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-plate-yellow">운동 모임 주간 하이라이트</p>
              <h1 className="text-2xl sm:text-3xl">{detail?.name || "모임 하이라이트"}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/crew/${crewIdNum}/lobby`} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">로비</Link>
              <Link to={`/crew/${crewIdNum}/challenges`} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">챌린지</Link>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="dg-well px-3 py-2 text-sm text-chalk" />
            </div>
          </div>
        </header>

        {error && <p className="dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, idx) => (
            <article
              key={card.key}
              className="dg-rise dg-lift relative overflow-hidden rounded-xl border-[3px] border-black bg-steel-800 p-4 shadow-md"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <span className={`dg-chip text-xs ${card.plate}`}>{card.label}</span>
              <p className={`mt-2 font-black ${card.big ? "text-xl" : "text-sm"}`}>{card.name}</p>
              <p className="font-num mt-1 text-sm font-bold text-steel-300">{card.sub}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <article className="dg-steel dg-rise p-5" style={{ animationDelay: "240ms" }}>
            <h2 className="text-lg font-black">이번 달 한 줄 요약</h2>
            <p className="mt-2 text-sm text-steel-200">
              {highlights?.mvp ? `${highlights.mvp.nickname} 님이 전체 랭킹 1위를 유지 중이고, ` : ""}
              {highlights?.growth ? `${highlights.growth.nickname} 님이 최근 상승세를 주도하고 있습니다.` : "데이터를 모으는 중입니다."}
            </p>
          </article>

          <article className="dg-whiteboard dg-rise p-5" style={{ animationDelay: "300ms" }}>
            <h2 className="font-pen text-3xl leading-none">추천 액션</h2>
            <ul className="mt-3 space-y-1.5 text-sm font-semibold">
              <li className="flex gap-2"><span className="text-board-red">•</span>상위권: 현재 순위 방어를 위한 일일 출석 유지</li>
              <li className="flex gap-2"><span className="text-board-red">•</span>중위권: 진행중 챌린지 완료율 10% 올리기</li>
              <li className="flex gap-2"><span className="text-board-red">•</span>하위권: 최근 점수 + 출석 점수 동시 회복</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
