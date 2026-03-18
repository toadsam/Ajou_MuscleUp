import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { crewApi } from "../services/crewApi";
import type { CrewDetail } from "../types/crew";

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

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 pb-20 pt-24 text-white">
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-16 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-cyan-900/35 via-slate-900/70 to-amber-900/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.2em] text-cyan-200">CREW WEEKLY HIGHLIGHTS</p>
              <h1 className="text-2xl font-black">{detail?.name || "모임 하이라이트"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/crew/${crewIdNum}/lobby`} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">로비</Link>
              <Link to={`/crew/${crewIdNum}/challenges`} className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">챌린지</Link>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-100">MVP</p>
            <p className="mt-1 text-lg font-black">{highlights?.mvp?.nickname ?? "-"}</p>
            <p className="text-xs text-amber-100/80">총점 {highlights?.mvp?.score ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4">
            <p className="text-xs text-emerald-100">성장왕</p>
            <p className="mt-1 text-lg font-black">{highlights?.growth?.nickname ?? "-"}</p>
            <p className="text-xs text-emerald-100/80">최근 점수 {highlights?.growth?.recentScore ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
            <p className="text-xs text-cyan-100">도전왕</p>
            <p className="mt-1 text-lg font-black">{highlights?.challenger?.nickname ?? "-"}</p>
            <p className="text-xs text-cyan-100/80">평균 완료율 {Math.round(highlights?.challenger?.challengeAverageCompletion ?? 0)}%</p>
          </article>
          <article className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4">
            <p className="text-xs text-fuchsia-100">HOT 챌린지</p>
            <p className="mt-1 text-sm font-black">{highlights?.activeChallenge?.title ?? "-"}</p>
            <p className="text-xs text-fuchsia-100/80">리더 {highlights?.challengeLeader?.nickname ?? "-"}</p>
          </article>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-black">이번 달 한 줄 요약</h2>
            <p className="mt-2 text-sm text-gray-200">
              {highlights?.mvp ? `${highlights.mvp.nickname} 님이 전체 랭킹 1위를 유지 중이고, ` : ""}
              {highlights?.growth ? `${highlights.growth.nickname} 님이 최근 상승세를 주도하고 있습니다.` : "데이터를 모으는 중입니다."}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-black">추천 액션</h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-200">
              <li>• 상위권: 현재 순위 방어를 위한 일일 출석 유지</li>
              <li>• 중위권: 진행중 챌린지 완료율 10% 올리기</li>
              <li>• 하위권: 최근 점수 + 출석 점수 동시 회복</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
