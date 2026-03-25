import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { crewApi } from "../services/crewApi";
import type { CrewChallenge, CrewDetail, CrewJoinRequest } from "../types/crew";

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const plus7Days = () => {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const challengeStatusText: Record<CrewChallenge["status"], string> = {
  UPCOMING: "예정",
  ONGOING: "진행중",
  ENDED: "종료",
};

const challengeStatusClass: Record<CrewChallenge["status"], string> = {
  UPCOMING: "bg-sky-500/15 text-sky-300 border-sky-300/40",
  ONGOING: "bg-emerald-500/15 text-emerald-300 border-emerald-300/40",
  ENDED: "bg-slate-500/20 text-slate-300 border-slate-300/30",
};

const kingStyleByTitle: Record<string, { icon: string; className: string }> = {
  "성실왕": { icon: "C", className: "border-cyan-300/50 bg-cyan-500/15 text-cyan-100" },
  "연승왕": { icon: "S", className: "border-emerald-300/50 bg-emerald-500/15 text-emerald-100" },
  "도전왕": { icon: "D", className: "border-amber-300/50 bg-amber-500/15 text-amber-100" },
};

const tierAuraClass: Record<CharacterTier, string> = {
  BRONZE: "from-amber-800/30 to-orange-500/20",
  SILVER: "from-slate-300/30 to-gray-500/20",
  GOLD: "from-yellow-300/35 to-amber-500/20",
  PLATINUM: "from-teal-300/35 to-cyan-500/20",
  DIAMOND: "from-indigo-300/35 to-blue-500/20",
  MASTER: "from-emerald-300/35 to-teal-500/20",
  GRANDMASTER: "from-fuchsia-300/35 to-purple-500/20",
  CHALLENGER: "from-orange-300/40 to-red-500/25",
};

const tierFromAttendance = (rate: number): CharacterTier => {
  if (rate >= 100) return "CHALLENGER";
  if (rate >= 85) return "MASTER";
  if (rate >= 70) return "DIAMOND";
  if (rate >= 55) return "PLATINUM";
  if (rate >= 40) return "GOLD";
  if (rate >= 20) return "SILVER";
  return "BRONZE";
};

type ViewTab = "dashboard" | "challenges" | "leaderboard" | "members";
const TAB_ORDER: ViewTab[] = ["dashboard", "challenges", "leaderboard", "members"];

type LocalUser = { nickname?: string };

type AvatarRow = {
  userId: number;
  nickname: string;
  attendanceRate?: number;
  characterTier?: CharacterTier | null;
  characterStage?: number | null;
  avatarSeed?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
};

const resolveAvatarConfig = (row: AvatarRow | null | undefined, fallbackRate = 0) => {
  const tier = (row?.characterTier ?? tierFromAttendance(row?.attendanceRate ?? fallbackRate)) as CharacterTier;
  const stage = row?.characterStage ?? Math.max(1, Math.min(9, Math.floor((row?.attendanceRate ?? fallbackRate) / 12)));
  const seed = row?.avatarSeed ?? `crew-avatar-${row?.userId ?? "x"}-${row?.nickname ?? "unknown"}`;
  return { tier, stage, seed, gender: row?.gender, isResting: row?.isResting ?? false };
};

function EnhancedAvatar({ seed, tier, stage, size, gender, isResting, rank, badge }: { seed: string; tier: CharacterTier; stage: number; size: number; gender?: "MALE" | "FEMALE" | null; isResting?: boolean; rank?: number; badge?: string }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${tierAuraClass[tier]} blur-md`} />
      {rank && rank <= 3 && <span className="absolute -top-3 z-20 rounded-full border border-yellow-200/70 bg-yellow-300 px-1.5 py-0.5 text-[10px] font-black text-slate-900">{rank === 1 ? "CROWN" : `TOP${rank}`}</span>}
      <div className="relative z-10 rounded-xl border border-white/15 bg-slate-900/70 p-1">
        <AvatarRenderer avatarSeed={seed} tier={tier} stage={stage} gender={gender} isResting={isResting ?? false} size={size} />
      </div>
      {badge && <span className="absolute -bottom-2 z-20 rounded-full border border-white/30 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">{badge}</span>}
    </div>
  );
}

const quickMissionLabel = (rate: number, rank: number | null) => {
  if (rank && rank <= 3) return "상위권 방어: 오늘 운동 기록 1회";
  if (rate >= 90) return "만점 도전: 출석률 100% 채우기";
  if (rate >= 60) return "중위권 돌파: 연속 2일 출석";
  return "기본기 미션: 오늘 출석 먼저 완료";
};

export default function CrewChallenge() {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const crewIdNum = Number(crewId || 0);

  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [expandedChallengeId, setExpandedChallengeId] = useState<number | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [tabMotion, setTabMotion] = useState<"left" | "right">("right");
  const [tabMotionTick, setTabMotionTick] = useState(0);
  const [challengeDragX, setChallengeDragX] = useState(0);
  const [isChallengeDragging, setIsChallengeDragging] = useState(false);
  const [isChallengeAnimating, setIsChallengeAnimating] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeStartDate, setChallengeStartDate] = useState(todayKey());
  const [challengeEndDate, setChallengeEndDate] = useState(plus7Days());
  const [challengeTargetDays, setChallengeTargetDays] = useState(4);

  const [editingChallengeId, setEditingChallengeId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState(todayKey());
  const [editEndDate, setEditEndDate] = useState(plus7Days());
  const [editTargetDays, setEditTargetDays] = useState(4);

  const [myNickname, setMyNickname] = useState("");
  const [rankDeltaByUser, setRankDeltaByUser] = useState<Record<number, number>>({});
  const [animatedRows, setAnimatedRows] = useState<number[]>([]);
  const [boardQuery, setBoardQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberSort, setMemberSort] = useState<"rank" | "weekly" | "attendance">("rank");
  const [memberVisibleCount, setMemberVisibleCount] = useState(24);
  const [joinRequests, setJoinRequests] = useState<CrewJoinRequest[]>([]);
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);
  const previousRanksRef = useRef<Record<number, number>>({});
  const tabSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const challengeSwipeStartRef = useRef<number | null>(null);
  const tabContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as LocalUser;
      setMyNickname(parsed.nickname ?? "");
    } catch {
      setMyNickname("");
    }
  }, []);

  useEffect(() => {
    if (animatedRows.length === 0) return;
    const timer = window.setTimeout(() => setAnimatedRows([]), 1800);
    return () => window.clearTimeout(timer);
  }, [animatedRows]);

  useEffect(() => {
    setMemberVisibleCount(24);
  }, [memberQuery, memberSort]);

  const myAttendanceRow = useMemo(() => {
    if (!detail?.members?.length) return null;
    if (myNickname) {
      const found = detail.members.find((m) => m.nickname === myNickname);
      if (found) return found;
    }
    return detail.members[0] ?? null;
  }, [detail?.members, myNickname]);

  const myBoardRow = useMemo(() => {
    if (!detail?.competitionBoard?.length) return null;
    if (myNickname) {
      const found = detail.competitionBoard.find((v) => v.nickname === myNickname);
      if (found) return found;
    }
    return detail.competitionBoard[0] ?? null;
  }, [detail?.competitionBoard, myNickname]);

  const nextGoal = useMemo(() => {
    if (!detail?.competitionBoard?.length || detail.competitionBoard.length < 2 || !myBoardRow) {
      return "오늘 운동 1회 기록으로 점수를 올려보세요.";
    }
    const target = detail.competitionBoard.find((v) => v.rank === myBoardRow.rank - 1);
    if (!target) return "상위권입니다. 순위를 지켜보세요.";
    const gap = Math.max(0, Number((target.score - myBoardRow.score).toFixed(1)));
    return `다음 순위까지 ${gap}점 차이입니다.`;
  }, [detail?.competitionBoard, myBoardRow]);

  const myAvatar = useMemo(() => resolveAvatarConfig(myAttendanceRow as any, myAttendanceRow?.attendanceRate ?? 0), [myAttendanceRow]);
  const ongoingChallengeCount = detail?.challenges.filter((c) => c.status === "ONGOING").length ?? 0;
  const missionLabel = quickMissionLabel(myAttendanceRow?.attendanceRate ?? 0, myBoardRow?.rank ?? null);
  const rivalRow = useMemo(() => {
    if (!detail?.competitionBoard?.length || !myBoardRow) return null;
    return detail.competitionBoard.find((row) => row.rank === myBoardRow.rank - 1) ?? null;
  }, [detail?.competitionBoard, myBoardRow]);
  const trailingRow = useMemo(() => {
    if (!detail?.competitionBoard?.length || !myBoardRow) return null;
    return detail.competitionBoard.find((row) => row.rank === myBoardRow.rank + 1) ?? null;
  }, [detail?.competitionBoard, myBoardRow]);
  const chaseGap = useMemo(() => {
    if (!rivalRow || !myBoardRow) return 0;
    return Math.max(0, Number((rivalRow.score - myBoardRow.score).toFixed(1)));
  }, [rivalRow, myBoardRow]);
  const defendGap = useMemo(() => {
    if (!trailingRow || !myBoardRow) return 0;
    return Math.max(0, Number((myBoardRow.score - trailingRow.score).toFixed(1)));
  }, [trailingRow, myBoardRow]);
  const myWeeklyWorkout = myBoardRow?.recentWorkoutDays ?? 0;
  const attendanceGauge = Math.max(0, Math.min(100, myAttendanceRow?.attendanceRate ?? 0));
  const weeklyGauge = Math.max(0, Math.min(100, (myWeeklyWorkout / 7) * 100));
  const questReward = Math.round((myWeeklyWorkout + 1) * 12 + (attendanceGauge >= 80 ? 18 : 8));
  const chasePressure = rivalRow ? Math.max(0, Math.min(100, 100 - chaseGap * 4)) : 100;

  const filteredBoard = useMemo(() => {
    if (!detail?.competitionBoard) return [];
    const q = boardQuery.trim().toLowerCase();
    if (!q) return detail.competitionBoard;
    return detail.competitionBoard.filter((row) => row.nickname.toLowerCase().includes(q));
  }, [detail?.competitionBoard, boardQuery]);

  const membersWithBoardMeta = useMemo(() => {
    if (!detail?.members) return [];
    const boardMap = new Map(detail.competitionBoard.map((row) => [row.userId, row]));
    const q = memberQuery.trim().toLowerCase();
    const merged = detail.members
      .filter((member) => (q ? member.nickname.toLowerCase().includes(q) : true))
      .map((member) => ({ member, board: boardMap.get(member.userId) ?? null }));
    merged.sort((a, b) => {
      if (memberSort === "weekly") {
        return (b.board?.recentWorkoutDays ?? 0) - (a.board?.recentWorkoutDays ?? 0);
      }
      if (memberSort === "attendance") {
        return b.member.attendanceRate - a.member.attendanceRate;
      }
      return (a.board?.rank ?? Number.MAX_SAFE_INTEGER) - (b.board?.rank ?? Number.MAX_SAFE_INTEGER);
    });
    return merged;
  }, [detail?.members, detail?.competitionBoard, memberQuery, memberSort]);

  const switchTab = (nextTab: ViewTab) => {
    if (nextTab === activeTab) return;
    const prevIndex = TAB_ORDER.indexOf(activeTab);
    const nextIndex = TAB_ORDER.indexOf(nextTab);
    setTabMotion(nextIndex >= prevIndex ? "right" : "left");
    setActiveTab(nextTab);
    setTabMotionTick((v) => v + 1);
    window.requestAnimationFrame(() => {
      tabContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const loadJoinRequests = async (targetCrewId: number) => {
    if (!targetCrewId) return;
    setJoinRequestLoading(true);
    try {
      const list = await crewApi.listJoinRequests(targetCrewId);
      setJoinRequests(list);
    } catch {
      setJoinRequests([]);
    } finally {
      setJoinRequestLoading(false);
    }
  };

  const loadDetail = async (targetCrewId: number, monthKey: string) => {
    if (!targetCrewId) return;
    try {
      const data = await crewApi.getDetail(targetCrewId, monthKey);

      const currentRanks: Record<number, number> = {};
      data.competitionBoard.forEach((row) => {
        currentRanks[row.userId] = row.rank;
      });

      const deltaMap: Record<number, number> = {};
      const changed: number[] = [];
      data.competitionBoard.forEach((row) => {
        const prev = previousRanksRef.current[row.userId];
        if (prev !== undefined) {
          const delta = prev - row.rank;
          if (delta !== 0) {
            deltaMap[row.userId] = delta;
            changed.push(row.userId);
          }
        }
      });

      setRankDeltaByUser(deltaMap);
      setAnimatedRows(changed);
      previousRanksRef.current = currentRanks;

      setDetail(data);
      if (data.leader) {
        void loadJoinRequests(targetCrewId);
      } else {
        setJoinRequests([]);
      }
      if (data.challenges.length > 0 && expandedChallengeId == null) {
        setExpandedChallengeId(data.challenges[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 상세를 불러오지 못했습니다.");
      setDetail(null);
    }
  };

  useEffect(() => {
    if (!crewIdNum || Number.isNaN(crewIdNum)) {
      navigate("/crew", { replace: true });
      return;
    }
    void loadDetail(crewIdNum, month);
  }, [crewIdNum, month]);

  const copyInviteLink = async () => {
    if (!detail) return;
    const link = `${window.location.origin}/crew?invite=${detail.inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setError("링크 복사에 실패했습니다.");
    }
  };

  const onJoin = async () => {
    if (!crewIdNum) return;
    setError("");
    try {
      const result = await crewApi.join(crewIdNum);
      if (result.result === "PENDING") {
        window.alert(result.message);
      }
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 참여에 실패했습니다.");
    }
  };

  const onLeave = async () => {
    if (!crewIdNum) return;
    setError("");
    try {
      await crewApi.leave(crewIdNum);
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 탈퇴에 실패했습니다.");
    }
  };

  const onUpdateCrew = async () => {
    if (!detail) return;
    setError("");
    try {
      const updated = await crewApi.update(crewIdNum, {
        name: detail.name,
        description: detail.description || "",
        joinPolicy: detail.joinPolicy ?? "AUTO_APPROVE",
      });
      setDetail(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 수정에 실패했습니다.");
    }
  };

  const onDeleteCrew = async () => {
    if (!detail) return;
    if (!window.confirm("모임을 삭제할까요?")) return;
    setError("");
    try {
      await crewApi.remove(crewIdNum);
      navigate("/crew");
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 삭제에 실패했습니다.");
    }
  };

  const onKickMember = async (memberUserId: number) => {
    if (!detail) return;
    if (!window.confirm("해당 멤버를 강퇴할까요?")) return;
    setError("");
    try {
      await crewApi.kickMember(crewIdNum, memberUserId);
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "멤버 강퇴에 실패했습니다.");
    }
  };

  const onApproveJoinRequest = async (requestId: number) => {
    if (!crewIdNum) return;
    setError("");
    try {
      await crewApi.approveJoinRequest(crewIdNum, requestId);
      await loadJoinRequests(crewIdNum);
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "가입 신청 승인에 실패했습니다.");
    }
  };

  const onRejectJoinRequest = async (requestId: number) => {
    if (!crewIdNum) return;
    setError("");
    try {
      await crewApi.rejectJoinRequest(crewIdNum, requestId);
      await loadJoinRequests(crewIdNum);
    } catch (e: any) {
      setError(e?.response?.data?.message || "가입 신청 거절에 실패했습니다.");
    }
  };

  const onCreateChallenge = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    setError("");
    try {
      await crewApi.createChallenge(crewIdNum, {
        title: challengeTitle.trim(),
        description: challengeDescription.trim(),
        startDate: challengeStartDate,
        endDate: challengeEndDate,
        targetWorkoutDays: challengeTargetDays,
      });
      setChallengeTitle("");
      setChallengeDescription("");
      setChallengeStartDate(todayKey());
      setChallengeEndDate(plus7Days());
      setChallengeTargetDays(4);
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "챌린지 생성에 실패했습니다.");
    }
  };

  const onDeleteChallenge = async (challengeId: number) => {
    if (!detail) return;
    if (!window.confirm("챌린지를 삭제할까요?")) return;
    setError("");
    try {
      await crewApi.deleteChallenge(crewIdNum, challengeId);
      if (editingChallengeId === challengeId) setEditingChallengeId(null);
      if (expandedChallengeId === challengeId) setExpandedChallengeId(null);
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "챌린지 삭제에 실패했습니다.");
    }
  };

  const startEditChallenge = (challenge: CrewChallenge) => {
    setEditingChallengeId(challenge.id);
    setEditTitle(challenge.title);
    setEditDescription(challenge.description ?? "");
    setEditStartDate(challenge.startDate);
    setEditEndDate(challenge.endDate);
    setEditTargetDays(challenge.targetWorkoutDays);
    setExpandedChallengeId(challenge.id);
  };

  const submitEditChallenge = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !editingChallengeId) return;
    setError("");
    try {
      await crewApi.updateChallenge(crewIdNum, editingChallengeId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        targetWorkoutDays: editTargetDays,
      });
      setEditingChallengeId(null);
      await loadDetail(crewIdNum, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "챌린지 수정에 실패했습니다.");
    }
  };

  const renderRankDelta = (userId: number) => {
    const delta = rankDeltaByUser[userId];
    if (!delta) return null;
    if (delta > 0) return <span className="ml-1 text-[11px] font-bold text-emerald-300">▲{delta}</span>;
    return <span className="ml-1 text-[11px] font-bold text-rose-300">▼{Math.abs(delta)}</span>;
  };

  const rankMotionClass = (userId: number) => {
    if (!animatedRows.includes(userId)) return "";
    const delta = rankDeltaByUser[userId] ?? 0;
    if (delta > 0) return "crew-rank-rise";
    if (delta < 0) return "crew-rank-fall";
    return "";
  };

  const renderDashboard = () => {
    if (!detail) return null;
    return (
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-500/15 via-slate-900/80 to-indigo-500/20 p-4 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <p className="text-[11px] tracking-[0.18em] text-cyan-200">BATTLE STATUS</p>
            <h3 className="mt-1 text-xl font-black text-cyan-100">랭크 전투 현황</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] text-gray-400">현재 순위</p>
                <p className="text-2xl font-black text-amber-200">#{myBoardRow?.rank ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] text-gray-400">전투 점수</p>
                <p className="text-2xl font-black text-fuchsia-200">{myBoardRow?.score ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] text-gray-400">주간 운동</p>
                <p className="text-2xl font-black text-emerald-200">{myWeeklyWorkout}회</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-cyan-100">
                <span>출석 게이지</span>
                <span>{attendanceGauge.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" style={{ width: `${attendanceGauge}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-100">
                <span>주간 연속 페이스</span>
                <span>{myWeeklyWorkout}/7</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" style={{ width: `${weeklyGauge}%` }} />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-300/35 bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-rose-500/20 p-4 shadow-[0_0_40px_rgba(251,191,36,0.12)]">
            <p className="text-[11px] tracking-[0.18em] text-amber-100">TODAY QUEST</p>
            <h3 className="mt-1 text-xl font-black text-amber-100">즉시 수행 미션</h3>
            <p className="mt-2 rounded-xl border border-amber-200/30 bg-black/30 px-3 py-2 text-sm text-amber-50">{missionLabel}</p>
            <div className="mt-3 rounded-xl border border-rose-200/30 bg-rose-500/10 p-3">
              <p className="text-[11px] text-rose-100/80">라이벌 압박도</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-300" style={{ width: `${chasePressure}%` }} />
              </div>
              <p className="mt-2 text-xs text-rose-100/80">{rivalRow ? `${rivalRow.nickname}까지 ${chaseGap}점` : "현재 최상위권 유지 중"}</p>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2">
              <span className="text-xs text-emerald-100">미션 성공 보상</span>
              <span className="text-lg font-black text-emerald-200">+{questReward} EXP</span>
            </div>
          </article>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-bold">왕 타이틀</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {detail.kingTitles?.map((king) => (
                <div key={king.title} className={`rounded-xl border p-3 ${kingStyleByTitle[king.title]?.className ?? "border-white/20 bg-white/10 text-white"} animate-pulse`}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/40 text-xs font-bold">{kingStyleByTitle[king.title]?.icon ?? "K"}</span>
                    <p className="text-xs">{king.title}</p>
                  </div>
                  <p className="mt-2 text-sm font-bold text-white">{king.nickname}</p>
                  <p className="text-xs opacity-90">{king.metric}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-bold">빠른 챌린지 현황</h3>
            <div className="mt-3 space-y-2">
              {detail.challenges.slice(0, 3).map((challenge) => (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => {
                    switchTab("challenges");
                    setExpandedChallengeId(challenge.id);
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{challenge.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${challengeStatusClass[challenge.status]}`}>{challengeStatusText[challenge.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{challenge.startDate} ~ {challenge.endDate}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (!detail) return null;
    const top3 = detail.competitionBoard.slice(0, 3);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
            {top3.map((row) => {
              const avatar = resolveAvatarConfig(detail.members.find((m) => m.userId === row.userId) ?? null, row.attendanceRate);
              return (
                <article key={row.userId} className={`rounded-2xl border border-white/15 bg-gradient-to-b ${row.rank === 1 ? "from-amber-400/25" : "from-cyan-400/20"} to-slate-900 p-4`}>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-300 px-2 py-1 text-xs font-bold text-slate-900">#{row.rank}</span>
                    <span className="text-xs text-amber-100">{row.score}점</span>
                  </div>
                  <div className="mt-2 flex justify-center">
                    <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} size={78} rank={row.rank} />
                  </div>
                  <p className="mt-2 text-center font-bold">{row.nickname}{renderRankDelta(row.userId)}</p>
                  <p className="text-center text-xs text-gray-300">출석 {row.attendanceRate}% · 주간 {row.recentWorkoutDays}회</p>
                </article>
              );
            })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <input
              value={boardQuery}
              onChange={(e) => setBoardQuery(e.target.value)}
              placeholder="닉네임 검색"
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <span className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs text-gray-300 whitespace-nowrap">
              {filteredBoard.length}명
            </span>
          </div>
          <div className="md:hidden space-y-2 max-h-[56vh] overflow-y-auto pr-1">
            {filteredBoard.map((row) => {
              const animated = animatedRows.includes(row.userId);
              return (
                <div
                  key={`m-${row.userId}`}
                  className={`rounded-xl border border-white/10 bg-black/20 p-3 ${animated ? "ring-1 ring-cyan-300/60" : ""} ${rankMotionClass(row.userId)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">#{row.rank} {row.nickname}{renderRankDelta(row.userId)}</p>
                    <p className="text-amber-200 font-bold">{row.score}점</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                      <p className="text-gray-400">주간</p>
                      <p className="font-semibold text-emerald-200">{row.recentWorkoutDays}회</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                      <p className="text-gray-400">출석률</p>
                      <p className="font-semibold">{row.attendanceRate}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                      <p className="text-gray-400">최근점수</p>
                      <p className="font-semibold text-cyan-200">{row.recentScore}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-[46px_1fr_58px_64px_62px] rounded-lg bg-white/5 px-3 py-2 text-[11px] text-gray-300 sm:grid-cols-[56px_1fr_90px_96px_80px]">
              <span>순위</span><span>닉네임</span><span>주간</span><span>출석률</span><span>점수</span>
            </div>
            <div className="mt-1 max-h-80 space-y-1 overflow-y-auto">
              {filteredBoard.map((row) => {
                const animated = animatedRows.includes(row.userId);
                return (
                  <div key={row.userId} className={`grid grid-cols-[46px_1fr_58px_64px_62px] rounded-lg px-3 py-2 text-sm transition-all sm:grid-cols-[56px_1fr_90px_96px_80px] ${row.rank <= 3 ? "bg-amber-500/5" : "bg-black/15"} ${animated ? "ring-1 ring-cyan-300/60" : ""} ${rankMotionClass(row.userId)}`}>
                    <span className="text-cyan-200">#{row.rank}{renderRankDelta(row.userId)}</span>
                    <div>
                      <p className="font-semibold">{row.nickname}</p>
                      <p className="text-[11px] text-gray-400">출석 {row.attendanceScore} + 도전 {row.challengeScore} + 최근 {row.recentScore}{row.bonusScore > 0 ? ` + 보너스 ${row.bonusScore}` : ""}</p>
                    </div>
                    <span className="text-emerald-200">{row.recentWorkoutDays}회</span>
                    <span>{row.attendanceRate}%</span>
                    <span className="font-semibold text-amber-200">{row.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChallenges = () => {
    if (!detail) return null;
    const challenges = detail.challenges;
    const activeChallengeIndex = Math.max(
      0,
      challenges.findIndex((c) => c.id === expandedChallengeId)
    );
    const activeChallenge = challenges[activeChallengeIndex] ?? challenges[0] ?? null;

    const moveChallengeFocus = (direction: "prev" | "next") => {
      if (challenges.length <= 1) return;
      const currentIndex = Math.max(
        0,
        challenges.findIndex((c) => c.id === expandedChallengeId)
      );
      const targetIndex =
        direction === "next"
          ? Math.min(challenges.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      setExpandedChallengeId(challenges[targetIndex].id);
    };

    const onChallengeSwipeStart = (x: number) => {
      if (isChallengeAnimating) return;
      challengeSwipeStartRef.current = x;
      setIsChallengeDragging(true);
    };

    const onChallengeSwipeMove = (x: number) => {
      if (challengeSwipeStartRef.current == null) return;
      const delta = x - challengeSwipeStartRef.current;
      const clamped = Math.max(-120, Math.min(120, delta));
      setChallengeDragX(clamped);
    };

    const onChallengeSwipeEnd = (x: number) => {
      if (challengeSwipeStartRef.current == null) return;
      const delta = x - challengeSwipeStartRef.current;
      const triggerHaptic = () => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(12);
        }
      };
      if (Math.abs(delta) > 55) {
        const toNext = delta < 0;
        setIsChallengeAnimating(true);
        setChallengeDragX(toNext ? -92 : 92);
        triggerHaptic();
        window.setTimeout(() => {
          moveChallengeFocus(toNext ? "next" : "prev");
          setChallengeDragX(toNext ? 78 : -78);
          window.requestAnimationFrame(() => {
            setChallengeDragX(0);
          });
          window.setTimeout(() => {
            setIsChallengeAnimating(false);
          }, 280);
        }, 130);
      } else {
        setChallengeDragX(0);
      }
      challengeSwipeStartRef.current = null;
      setIsChallengeDragging(false);
    };

    return (
      <div className="space-y-4">
        {activeChallenge && (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 md:hidden">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-cyan-200">스와이프 챌린지 카드</p>
            <div
              className="select-none rounded-xl border border-white/15 bg-black/25 p-3 transition-transform duration-200 ease-out"
              style={{
                transform: `translateX(${challengeDragX}px) rotate(${challengeDragX / 38}deg) scale(${1 - Math.min(0.05, Math.abs(challengeDragX) / 720)})`,
                transition: isChallengeDragging
                  ? "none"
                  : isChallengeAnimating
                  ? "transform 340ms cubic-bezier(0.18, 0.8, 0.24, 1.15)"
                  : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                boxShadow: isChallengeAnimating
                  ? "0 0 0 1px rgba(103,232,249,0.35), 0 10px 30px rgba(6,182,212,0.22)"
                  : "none",
              }}
              onTouchStart={(e) => onChallengeSwipeStart(e.touches[0].clientX)}
              onTouchMove={(e) => onChallengeSwipeMove(e.touches[0].clientX)}
              onTouchEnd={(e) => onChallengeSwipeEnd(e.changedTouches[0].clientX)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{activeChallenge.title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${challengeStatusClass[activeChallenge.status]}`}>
                  {challengeStatusText[activeChallenge.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">{activeChallenge.startDate} ~ {activeChallenge.endDate}</p>
              <p className="mt-1 text-xs text-emerald-200">목표 {activeChallenge.targetWorkoutDays}일</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => moveChallengeFocus("prev")} className="rounded-lg border border-white/20 px-2 py-1 text-[11px] text-gray-200">이전</button>
              <p className="text-[11px] text-gray-400">{activeChallengeIndex + 1} / {challenges.length}</p>
              <button type="button" onClick={() => moveChallengeFocus("next")} className="rounded-lg border border-white/20 px-2 py-1 text-[11px] text-gray-200">다음</button>
            </div>
          </div>
        )}
        {detail.leader && manageMode && (
          <form onSubmit={onCreateChallenge} className="space-y-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
            <h3 className="text-lg font-bold">챌린지 만들기</h3>
            <input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} placeholder="챌린지 제목" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
            <textarea value={challengeDescription} onChange={(e) => setChallengeDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input type="date" value={challengeStartDate} onChange={(e) => setChallengeStartDate(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
              <input type="date" value={challengeEndDate} onChange={(e) => setChallengeEndDate(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
              <input type="number" min={1} max={31} value={challengeTargetDays} onChange={(e) => setChallengeTargetDays(Number(e.target.value))} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">챌린지 생성</button>
          </form>
        )}

        <div className="space-y-3">
          {detail.challenges.length === 0 && <p className="text-sm text-gray-400">등록된 챌린지가 없습니다.</p>}
          {detail.challenges.map((challenge) => {
            const topMember = challenge.members[0];
            const isExpanded = expandedChallengeId === challenge.id;
            const isEditing = editingChallengeId === challenge.id;
            return (
              <article key={challenge.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)} className="text-left">
                    <div className="flex items-center gap-2">
                      <strong>{challenge.title}</strong>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${challengeStatusClass[challenge.status]}`}>{challengeStatusText[challenge.status]}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{challenge.startDate} ~ {challenge.endDate} · 목표 {challenge.targetWorkoutDays}일</p>
                  </button>
                  <div className="flex items-center gap-2">
                    {detail.leader && manageMode && <><button type="button" onClick={() => startEditChallenge(challenge)} className="rounded-lg border border-cyan-300/40 px-2 py-1 text-xs text-cyan-200">수정</button><button type="button" onClick={() => void onDeleteChallenge(challenge.id)} className="rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-300">삭제</button></>}
                    <button type="button" onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)} className="rounded-lg border border-white/20 px-2 py-1 text-xs text-gray-200">{isExpanded ? "접기" : "펼치기"}</button>
                  </div>
                </div>
                {challenge.description && <p className="mt-2 text-sm text-gray-300">{challenge.description}</p>}
                {topMember && <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">현재 1위: <strong>{topMember.nickname}</strong> · {topMember.completionRate}% ({topMember.workoutDays}/{topMember.targetWorkoutDays})</div>}

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {isEditing && detail.leader && manageMode && (
                      <form onSubmit={submitEditChallenge} className="space-y-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
                        <p className="text-sm font-semibold text-cyan-200">챌린지 수정</p>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="챌린지 제목" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                        <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /><input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /><input type="number" min={1} max={31} value={editTargetDays} onChange={(e) => setEditTargetDays(Number(e.target.value))} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /></div>
                        <div className="flex gap-2"><button type="submit" className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">저장</button><button type="button" onClick={() => setEditingChallengeId(null)} className="rounded-lg border border-white/25 px-3 py-2 text-sm text-gray-200">취소</button></div>
                      </form>
                    )}
                    <div className="grid gap-2 md:grid-cols-2">
                      {challenge.members.map((member, index) => {
                        const avatar = resolveAvatarConfig(member as any, member.completionRate);
                        return <div key={`${challenge.id}-${member.userId}`} className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm"><div className="flex items-center gap-2"><EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} size={48} rank={index + 1} badge={member.badge} /><div className="flex-1"><div className="flex items-center justify-between"><span>{member.nickname}</span><span className="text-cyan-300">{member.completionRate}%</span></div><p className="mt-1 text-xs text-gray-400">{member.workoutDays}/{member.targetWorkoutDays}</p></div></div></div>;
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMembers = () => {
    if (!detail) return null;
    const visibleMembers = membersWithBoardMeta.slice(0, memberVisibleCount);
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="멤버 닉네임 검색"
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <select
              value={memberSort}
              onChange={(e) => setMemberSort(e.target.value as "rank" | "weekly" | "attendance")}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            >
              <option value="rank">순위순</option>
              <option value="weekly">주간 운동순</option>
              <option value="attendance">출석률순</option>
            </select>
            <div className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-gray-200">
              {membersWithBoardMeta.length}명
            </div>
          </div>
        </div>

        <div className="md:hidden space-y-2">
          {visibleMembers.map(({ member, board }) => {
            const avatar = resolveAvatarConfig(member as any, member.attendanceRate);
            const memberRank = board?.rank ?? "-";
            const weeklyWorkout = board?.recentWorkoutDays ?? 0;
            return (
              <article key={`mobile-${member.userId}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} size={42} />
                    <div>
                      <p className="text-sm font-semibold">{member.nickname}</p>
                      <p className="text-[11px] text-gray-400">#{memberRank} · {member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400">이번주</p>
                    <p className="text-sm font-bold text-emerald-200">{weeklyWorkout}회</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">출석률 {member.attendanceRate}% · {member.workoutDays}/{member.targetDays}</p>
              </article>
            );
          })}
        </div>

        <div className="hidden md:grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleMembers.map(({ member, board }) => {
          const avatar = resolveAvatarConfig(member as any, member.attendanceRate);
          const memberRank = board?.rank ?? "-";
          const weeklyWorkout = board?.recentWorkoutDays ?? 0;
          return (
            <article key={member.userId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} size={60} />
                <div>
                  <p className="font-semibold">{member.nickname}</p>
                  <p className="text-xs text-gray-400">#{memberRank} · {member.role}</p>
                  {member.characterLevel != null && <p className="text-[11px] text-cyan-200">Lv.{member.characterLevel}</p>}
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.min(member.attendanceRate, 100)}%` }} /></div>
              <p className="mt-2 text-xs text-gray-400">출석률 {member.attendanceRate}% · {member.workoutDays}/{member.targetDays}</p>
              <p className="mt-1 text-xs text-emerald-200">이번주 운동 {weeklyWorkout}회</p>
              {detail.leader && manageMode && member.role !== "LEADER" && <button type="button" onClick={() => void onKickMember(member.userId)} className="mt-3 rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-300">강퇴</button>}
            </article>
          );
        })}
        </div>
        {memberVisibleCount < membersWithBoardMeta.length && (
          <button
            type="button"
            onClick={() => setMemberVisibleCount((prev) => prev + 24)}
            className="w-full rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            멤버 더 보기 (+24)
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#040714] pb-28 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,rgba(56,189,248,0.22)_1px,transparent_0)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6 lg:px-10">
        <div className="crew-hud-glow relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-900/35 via-slate-900/70 to-emerald-900/25 p-4 shadow-[0_0_50px_rgba(56,189,248,0.12)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(20,184,166,0.16),transparent_45%)]" />
          <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] font-black tracking-[0.14em] text-cyan-100">
            MuscleUp
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.22em] text-cyan-200">CREW CHALLENGE ARENA</p>
              <h1 className="text-2xl font-black text-cyan-50 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]">{detail?.name || "모임 챌린지"}</h1>
              <p className="text-xs text-cyan-100/85">{nextGoal}</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              <Link to="/crew" className="rounded-lg border border-white/20 px-3 py-2 text-center text-sm text-gray-200 hover:bg-white/10">모임 허브</Link>
              <Link to={`/crew/${crewIdNum}/lobby`} className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-100 hover:bg-cyan-500/20">로비</Link>
              <Link to={`/crew/${crewIdNum}/highlights`} className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100 hover:bg-amber-500/20">하이라이트</Link>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm col-span-2 sm:col-span-1" />
            </div>
          </div>
        </div>

        <div className="crew-hud-glow-soft sticky top-20 z-30 rounded-2xl border border-cyan-300/30 bg-slate-900/88 p-3 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/80 p-3">
              <p className="text-[11px] text-gray-400">내 캐릭터</p>
              <div className="mt-1 flex items-center gap-2">
                <EnhancedAvatar seed={myAvatar.seed} tier={myAvatar.tier} stage={myAvatar.stage} gender={myAvatar.gender} isResting={myAvatar.isResting} size={38} />
                <p className="text-sm font-semibold">{myAttendanceRow?.nickname ?? "-"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-500/10 to-slate-900/80 p-3">
              <p className="text-[11px] text-gray-400">현재 순위</p>
              <p className="text-xl font-black text-amber-200">#{myBoardRow?.rank ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 to-slate-900/80 p-3">
              <p className="text-[11px] text-gray-400">활성 챌린지</p>
              <p className="text-xl font-black">{ongoingChallengeCount}</p>
            </div>
            <div className="rounded-xl border border-amber-300/35 bg-gradient-to-br from-amber-500/15 to-rose-500/10 p-3">
              <p className="text-[11px] text-amber-100/80">이번주 스프린트</p>
              <p className="text-sm font-black text-amber-200">주간 운동 {myWeeklyWorkout}회</p>
              <p className="mt-1 text-[11px] text-amber-100/80">
                {rivalRow ? `다음 목표 ${rivalRow.nickname} · ${chaseGap}점 차이` : missionLabel}
              </p>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-rose-300/35 bg-gradient-to-br from-rose-500/15 to-slate-900/80 p-3">
              <p className="text-[11px] text-rose-100/80">내 바로 위 라이벌</p>
              {rivalRow ? (
                <>
                  <p className="mt-1 text-sm font-black text-rose-100">{rivalRow.nickname}</p>
                  <p className="text-[11px] text-rose-100/80">#{rivalRow.rank} · 주간 {rivalRow.recentWorkoutDays}회 · {chaseGap}점 차이</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-rose-100/80">현재 1위입니다. 방어 모드 유지!</p>
              )}
            </div>
            <div className="rounded-xl border border-emerald-300/35 bg-gradient-to-br from-emerald-500/15 to-slate-900/80 p-3">
              <p className="text-[11px] text-emerald-100/80">내 바로 아래 추격자</p>
              {trailingRow ? (
                <>
                  <p className="mt-1 text-sm font-black text-emerald-100">{trailingRow.nickname}</p>
                  <p className="text-[11px] text-emerald-100/80">#{trailingRow.rank} · 주간 {trailingRow.recentWorkoutDays}회 · {defendGap}점 차이</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-emerald-100/80">추격자 없음. 페이스 유지!</p>
              )}
            </div>
          </div>
        </div>

        <div className="hidden flex-wrap gap-2 md:flex">
          {[{ key: "dashboard", label: "대시보드" }, { key: "challenges", label: "챌린지" }, { key: "leaderboard", label: "리더보드" }, { key: "members", label: "멤버" }].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchTab(tab.key as ViewTab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border border-cyan-200/60 bg-gradient-to-r from-cyan-300 to-blue-300 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.45)]"
                  : "border border-white/20 bg-black/25 text-gray-200 hover:border-cyan-300/45 hover:bg-cyan-500/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {!detail && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-gray-300">불러오는 중...</div>}

        {detail && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <input value={detail.name} onChange={(e) => setDetail((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xl font-extrabold" />
                  <textarea value={detail.description ?? ""} onChange={(e) => setDetail((prev) => (prev ? { ...prev, description: e.target.value } : prev))} rows={2} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-gray-300" />
                  {detail.leader && (
                    <select
                      value={detail.joinPolicy ?? "AUTO_APPROVE"}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? { ...prev, joinPolicy: e.target.value as "AUTO_APPROVE" | "LEADER_APPROVE" }
                            : prev
                        )
                      }
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-cyan-100"
                    >
                      <option value="AUTO_APPROVE">가입 방식: 즉시 참여</option>
                      <option value="LEADER_APPROVE">가입 방식: 방장 승인 필요</option>
                    </select>
                  )}
                  <div className="flex items-center gap-2 text-xs text-cyan-300"><span>초대코드: <span className="font-bold">{detail.inviteCode}</span></span><button type="button" onClick={() => void copyInviteLink()} className="rounded-md border border-cyan-300/40 px-2 py-1 text-cyan-200 hover:bg-cyan-500/10">{copiedLink ? "복사됨" : "링크 복사"}</button></div>
                </div>
                <div className="flex items-center gap-2">
                  {detail.joined ? <button type="button" onClick={() => void onLeave()} className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">모임 탈퇴</button> : <button type="button" onClick={() => void onJoin()} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">모임 참여</button>}
                  {detail.leader && <><button type="button" onClick={() => setManageMode((prev) => !prev)} className={`rounded-lg border px-3 py-2 text-sm ${manageMode ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/25 bg-black/25 text-gray-200"}`}>{manageMode ? "관리 모드 ON" : "관리 모드"}</button>{manageMode && <><button type="button" onClick={() => void onUpdateCrew()} className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">모임 수정</button><button type="button" onClick={() => void onDeleteCrew()} className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">모임 삭제</button></>}</>}
                </div>
              </div>
            </div>

            {detail.leader && manageMode && (
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-cyan-100">가입 신청 관리</h3>
                  <span className="text-xs text-cyan-200">대기 {joinRequests.length}건</span>
                </div>
                {joinRequestLoading && <p className="text-xs text-gray-300">불러오는 중...</p>}
                {!joinRequestLoading && joinRequests.length === 0 && (
                  <p className="text-xs text-gray-300">현재 대기 중인 가입 신청이 없습니다.</p>
                )}
                <div className="space-y-2">
                  {joinRequests.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{request.nickname}</p>
                        <p className="truncate text-[11px] text-gray-400">{request.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onApproveJoinRequest(request.id)}
                          className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRejectJoinRequest(request.id)}
                          className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              ref={tabContentRef}
              className="touch-pan-y"
              onTouchStart={(e) => {
                tabSwipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              }}
              onTouchEnd={(e) => {
                const start = tabSwipeStartRef.current;
                if (!start) return;
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const dx = endX - start.x;
                const dy = endY - start.y;
                tabSwipeStartRef.current = null;
                if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
                const currentIndex = TAB_ORDER.indexOf(activeTab);
                if (dx < 0 && currentIndex < TAB_ORDER.length - 1) switchTab(TAB_ORDER[currentIndex + 1]);
                if (dx > 0 && currentIndex > 0) switchTab(TAB_ORDER[currentIndex - 1]);
              }}
            >
              <div
                key={`${activeTab}-${tabMotionTick}`}
                style={{ animation: `${tabMotion === "right" ? "crewTabSlideInRight" : "crewTabSlideInLeft"} 240ms ease-out` }}
              >
                {activeTab === "dashboard" && renderDashboard()}
                {activeTab === "challenges" && renderChallenges()}
                {activeTab === "leaderboard" && renderLeaderboard()}
                {activeTab === "members" && renderMembers()}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="fixed inset-x-4 bottom-4 z-[70] md:hidden pointer-events-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-cyan-300/25 bg-slate-900/95 p-2 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur">
          {[{ key: "dashboard", label: "대시" }, { key: "challenges", label: "챌린지" }, { key: "leaderboard", label: "랭킹" }, { key: "members", label: "멤버" }].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchTab(tab.key as ViewTab)}
              className={`touch-manipulation rounded-xl py-2 text-xs font-semibold ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-cyan-300 to-blue-300 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.4)]"
                  : "text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes crewTabSlideInRight{from{opacity:.35;transform:translate3d(22px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
        @keyframes crewTabSlideInLeft{from{opacity:.35;transform:translate3d(-22px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
        @keyframes crewRankRise{0%{transform:translateY(0);box-shadow:0 0 0 rgba(16,185,129,0)}35%{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(16,185,129,.5),0 8px 18px rgba(16,185,129,.22)}100%{transform:translateY(0);box-shadow:0 0 0 rgba(16,185,129,0)}}
        @keyframes crewRankFall{0%{transform:translateY(0);box-shadow:0 0 0 rgba(244,63,94,0)}35%{transform:translateY(2px);box-shadow:0 0 0 1px rgba(244,63,94,.45),0 8px 18px rgba(244,63,94,.18)}100%{transform:translateY(0);box-shadow:0 0 0 rgba(244,63,94,0)}}
        @keyframes crewHudPulse{0%{box-shadow:0 0 0 rgba(34,211,238,0)}50%{box-shadow:0 0 24px rgba(34,211,238,.18)}100%{box-shadow:0 0 0 rgba(34,211,238,0)}}
        @keyframes crewHudPulseSoft{0%{box-shadow:0 0 0 rgba(16,185,129,0)}50%{box-shadow:0 0 18px rgba(16,185,129,.14)}100%{box-shadow:0 0 0 rgba(16,185,129,0)}}
        .crew-rank-rise{animation:crewRankRise .9s ease-out}
        .crew-rank-fall{animation:crewRankFall .9s ease-out}
        .crew-hud-glow{animation:crewHudPulse 2.8s ease-in-out infinite}
        .crew-hud-glow-soft{animation:crewHudPulseSoft 3.4s ease-in-out infinite}
      `}</style>
    </section>
  );
}
