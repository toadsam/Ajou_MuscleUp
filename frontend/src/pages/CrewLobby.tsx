import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { crewApi } from "../services/crewApi";
import type { CrewDetail } from "../types/crew";
import { useCountUp } from "../hooks/useCountUp";

function CountNumber({ value }: { value: number | null | undefined }) {
  const v = useCountUp(value ?? 0, { duration: 800 });
  if (value == null) return <>-</>;
  return <>{Math.round(v)}</>;
}

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

// 피드 종류는 왼쪽 원판 색 띠로 구분한다.
const feedStyle: Record<FeedType, string> = {
  rank_up: "border-l-plate-green",
  rank_down: "border-l-plate-red",
  challenge: "border-l-plate-blue",
  attendance: "border-l-plate-yellow",
  system: "border-l-steel-500",
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
    <section className="relative min-h-screen overflow-hidden pb-20 pt-24 text-white">
      <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
        <header className="dg-steel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-num flex items-center gap-2 text-sm font-bold text-plate-yellow">
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-plate-red opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-black bg-plate-red" />
                </span>
                Crew Lobby Live Feed
              </p>
              <h1 className="text-2xl sm:text-3xl">{detail?.name || "모임 로비"}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/crew/${crewIdNum}/challenges`} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">챌린지</Link>
              <Link to={`/crew/${crewIdNum}/highlights`} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">하이라이트</Link>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="dg-well px-3 py-2 text-sm text-chalk" />
            </div>
          </div>
        </header>

        {error && <p className="dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="dg-rise rounded-xl border-[3px] border-black bg-steel-800 p-4 shadow-md">
            <p className="text-xs text-steel-400">모임 인원</p>
            <p className="font-num text-4xl font-black text-plate-yellow">{summary ? <CountNumber value={summary.members} /> : "-"}</p>
          </div>
          <div className="dg-rise rounded-xl border-[3px] border-black bg-steel-800 p-4 shadow-md" style={{ animationDelay: "60ms" }}>
            <p className="text-xs text-steel-400">활성 챌린지</p>
            <p className="font-num text-4xl font-black text-plate-green">{summary ? <CountNumber value={summary.activeChallenges} /> : "-"}</p>
          </div>
          <div className="dg-rise rounded-xl border-[3px] border-black bg-steel-800 p-4 shadow-md" style={{ animationDelay: "120ms" }}>
            <p className="text-xs text-steel-400">현재 1위</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-black text-white">
              <span className="font-num grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-plate-yellow text-sm text-black">1</span>
              {summary?.top?.nickname ?? "-"}
            </p>
          </div>
        </div>

        <div className="dg-steel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">실시간 피드</h2>
            <span className="text-xs text-steel-400">12초 주기 갱신</span>
          </div>
          <div className="space-y-2">
            {feed.length === 0 && <p className="text-sm text-steel-400">이벤트를 기다리는 중입니다.</p>}
            {feed.map((item, idx) => (
              <article
                key={item.id}
                className={`dg-well dg-rise border-l-[6px] p-3 text-sm text-steel-100 ${feedStyle[item.type]}`}
                style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
              >
                <p>{item.message}</p>
                <p className="font-num mt-1 text-xs text-steel-400">{new Date(item.createdAt).toLocaleTimeString()}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
