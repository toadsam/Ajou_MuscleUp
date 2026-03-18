import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { crewApi } from "../services/crewApi";
import type { CrewDetail } from "../types/crew";

type FeedType = "rank_up" | "rank_down" | "challenge" | "attendance" | "system";
type FeedItem = {
  id: string;
  type: FeedType;
  message: string;
  createdAt: number;
};

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const feedStyle: Record<FeedType, string> = {
  rank_up: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
  rank_down: "border-rose-300/35 bg-rose-500/10 text-rose-100",
  challenge: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
  attendance: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  system: "border-white/20 bg-white/5 text-gray-200",
};

const createDeltaFeed = (prev: CrewDetail, next: CrewDetail): FeedItem[] => {
  const now = Date.now();
  const entries: FeedItem[] = [];

  const prevRankByUser = new Map(prev.competitionBoard.map((v) => [v.userId, v.rank]));
  next.competitionBoard.forEach((row) => {
    const oldRank = prevRankByUser.get(row.userId);
    if (!oldRank || oldRank === row.rank) return;
    const up = oldRank - row.rank;
    entries.push({
      id: `rank-${row.userId}-${now}-${row.rank}`,
      type: up > 0 ? "rank_up" : "rank_down",
      message: `${row.nickname} 님 순위 ${oldRank}위 → ${row.rank}위`,
      createdAt: now,
    });
  });

  const prevChallenge = new Map(prev.challenges.map((c) => [c.id, c.status]));
  next.challenges.forEach((challenge) => {
    const old = prevChallenge.get(challenge.id);
    if (!old || old === challenge.status) return;
    entries.push({
      id: `challenge-${challenge.id}-${now}-${challenge.status}`,
      type: "challenge",
      message: `${challenge.title} 상태 변경: ${old} → ${challenge.status}`,
      createdAt: now,
    });
  });

  const prevAttendance = new Map(prev.members.map((m) => [m.userId, m.attendanceRate]));
  next.members.forEach((member) => {
    const oldRate = prevAttendance.get(member.userId);
    if (oldRate == null) return;
    if (member.attendanceRate > oldRate) {
      entries.push({
        id: `attendance-${member.userId}-${now}-${member.attendanceRate}`,
        type: "attendance",
        message: `${member.nickname} 님 출석률 상승 (${oldRate}% → ${member.attendanceRate}%)`,
        createdAt: now,
      });
    }
  });

  if (prev.members.length !== next.members.length) {
    entries.push({
      id: `members-${now}-${next.members.length}`,
      type: "system",
      message: `모임 인원 변경: ${prev.members.length}명 → ${next.members.length}명`,
      createdAt: now,
    });
  }

  return entries.slice(0, 8);
};

export default function CrewLobby() {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const crewIdNum = Number(crewId || 0);

  const [month, setMonth] = useState(currentMonthKey());
  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const previousRef = useRef<CrewDetail | null>(null);

  const loadDetail = async (id: number, monthKey: string, isFirstLoad = false) => {
    try {
      const next = await crewApi.getDetail(id, monthKey);
      setDetail(next);
      if (isFirstLoad) {
        setFeed([
          {
            id: `init-${Date.now()}`,
            type: "system",
            message: "로비 연결 완료. 실시간 피드를 수신합니다.",
            createdAt: Date.now(),
          },
        ]);
      } else if (previousRef.current) {
        const diff = createDeltaFeed(previousRef.current, next);
        if (diff.length > 0) {
          setFeed((prev) => [...diff, ...prev].slice(0, 40));
        }
      }
      previousRef.current = next;
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 로비를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    if (!crewIdNum || Number.isNaN(crewIdNum)) {
      navigate("/crew", { replace: true });
      return;
    }
    void loadDetail(crewIdNum, month, true);
    const timer = window.setInterval(() => {
      void loadDetail(crewIdNum, month);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [crewIdNum, month]);

  const summary = useMemo(() => {
    if (!detail) return null;
    return {
      members: detail.members.length,
      activeChallenges: detail.challenges.filter((c) => c.status === "ONGOING").length,
      top: detail.competitionBoard[0],
    };
  }, [detail]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 pb-20 pt-24 text-white">
      <div className="pointer-events-none absolute -left-28 top-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-cyan-900/35 via-slate-900/70 to-emerald-900/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.2em] text-cyan-200">CREW LOBBY LIVE FEED</p>
              <h1 className="text-2xl font-black">{detail?.name || "모임 로비"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/crew/${crewIdNum}/challenges`} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">챌린지</Link>
              <Link to={`/crew/${crewIdNum}/highlights`} className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">하이라이트</Link>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] text-gray-400">모임 인원</p>
            <p className="text-2xl font-black text-cyan-100">{summary?.members ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] text-gray-400">활성 챌린지</p>
            <p className="text-2xl font-black text-emerald-100">{summary?.activeChallenges ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] text-gray-400">현재 1위</p>
            <p className="text-lg font-black text-amber-100">{summary?.top?.nickname ?? "-"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black">실시간 피드</h2>
            <span className="text-xs text-gray-400">12초 주기 갱신</span>
          </div>
          <div className="space-y-2">
            {feed.length === 0 && <p className="text-sm text-gray-400">이벤트를 기다리는 중입니다.</p>}
            {feed.map((item) => (
              <article key={item.id} className={`rounded-xl border p-3 text-sm ${feedStyle[item.type]}`}>
                <p>{item.message}</p>
                <p className="mt-1 text-[11px] opacity-80">{new Date(item.createdAt).toLocaleTimeString()}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
