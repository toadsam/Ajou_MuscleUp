import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { crewApi } from "../services/crewApi";
import type { CrewChallenge, CrewDetail, CrewJoinRequest } from "../types/crew";
import { CREW_ROLE_LABEL } from "../types/crew";
import { toast } from "../lib/toast";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";
import { displayEmail } from "../lib/displayEmail";

// 입력칸: 철판 안쪽의 어두운 칸 + 포커스 시 노란 외곽선
const FIELD =
  "dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";

// 칸으로 나뉜 게이지: 화면에 들어오면 칸이 하나씩 켜진다.
function SegGauge({ value, cells = 10, on = "bg-plate-green" }: { value: number; cells?: number; on?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells);
  return (
    <div ref={ref} className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-[2px] border border-black transition-colors duration-200 ${inView && i < lit ? on : "bg-steel-900"}`}
          style={{ transitionDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

// 0 에서 값까지 굴려 올린다. 소수점 자리는 원래 값 그대로 보여준다.
function CountNumber({ value }: { value: number }) {
  const v = useCountUp(value, { duration: 900 });
  const digits = Number.isInteger(value) ? 0 : Math.min(2, String(value).split(".")[1]?.length ?? 0);
  return <>{v.toFixed(digits)}</>;
}

// 1~3위 메달 원판(노랑 · 회색 · 빨강)
const RANK_PLATE: Record<number, string> = {
  1: "bg-plate-yellow text-black",
  2: "bg-steel-300 text-black",
  3: "bg-plate-red text-white",
};


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
  UPCOMING: "bg-plate-blue text-white",
  ONGOING: "bg-plate-green text-white",
  ENDED: "bg-steel-700 text-steel-300",
};

const kingStyleByTitle: Record<string, { icon: string; className: string }> = {
  "성실왕": { icon: "C", className: "border-l-plate-yellow" },
  "연승왕": { icon: "S", className: "border-l-plate-green" },
  "도전왕": { icon: "D", className: "border-l-plate-red" },
};

// 티어별 아바타 액자 테두리 색 (예전 블러 후광 대신)
const tierAuraClass: Record<CharacterTier, string> = {
  BRONZE: "border-orange-700",
  SILVER: "border-steel-300",
  GOLD: "border-plate-yellow",
  PLATINUM: "border-green-300",
  DIAMOND: "border-plate-blue",
  MASTER: "border-plate-green",
  GRANDMASTER: "border-plate-red",
  CHALLENGER: "border-orange-400",
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
  tank?: string | null;
  isPumped?: boolean;
};

const resolveAvatarConfig = (row: AvatarRow | null | undefined, fallbackRate = 0) => {
  const tier = (row?.characterTier ?? tierFromAttendance(row?.attendanceRate ?? fallbackRate)) as CharacterTier;
  const stage = row?.characterStage ?? Math.max(1, Math.min(9, Math.floor((row?.attendanceRate ?? fallbackRate) / 12)));
  const seed = row?.avatarSeed ?? `crew-avatar-${row?.userId ?? "x"}-${row?.nickname ?? "unknown"}`;
  return { tier, stage, seed, gender: row?.gender, isResting: row?.isResting ?? false, tank: row?.tank ?? null, pumped: row?.isPumped ?? false };
};

function EnhancedAvatar({ seed, tier, stage, size, gender, isResting, tank, pumped, rank, badge }: { seed: string; tier: CharacterTier; stage: number; size: number; gender?: "MALE" | "FEMALE" | null; isResting?: boolean; tank?: string | null; pumped?: boolean; rank?: number; badge?: string }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {rank && rank <= 3 && <span className={`font-num absolute -top-3 z-20 rounded-sm border-2 border-black px-1.5 py-0 text-xs font-black ${RANK_PLATE[rank]}`}>{`${rank}위`}</span>}
      <div className={`relative z-10 rounded-md border-[3px] bg-steel-900 p-1 ${tierAuraClass[tier]}`}>
        <AvatarRenderer avatarSeed={seed} tier={tier} stage={stage} gender={gender} isResting={isResting ?? false} tank={tank} pumped={pumped} size={size} />
      </div>
      {badge && <span className="absolute -bottom-2 z-20 rounded-sm border-2 border-black bg-steel-700 px-1.5 py-0 text-[11px] font-bold text-chalk">{badge}</span>}
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
  // 화면에서만 계산하는 참고 점수다. 서버가 경험치로 지급하지 않으므로 "EXP"라고 약속하지 않는다.
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
    const boardMap = new Map((detail.competitionBoard ?? []).map((row) => [row.userId, row]));
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
    if (!detail?.inviteCode) return;
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
        toast(result.message || "참여 신청을 보냈어요. 방장이 승인하면 들어갈 수 있어요.");
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
    if (delta > 0) return <span className="dg-pop font-num ml-1 inline-block text-sm font-black text-green-300">▲{delta}</span>;
    return <span className="dg-pop font-num ml-1 inline-block text-sm font-black text-red-300">▼{Math.abs(delta)}</span>;
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
          <article className="dg-steel dg-rise p-5">
            <p className="text-sm font-bold text-plate-yellow">순위 현황</p>
            <h3 className="font-display mt-1 text-xl text-white">랭크 전투 현황</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="dg-well p-3">
                <p className="text-xs text-steel-400">현재 순위</p>
                <p className="font-num text-4xl font-black text-plate-yellow">
                  #{myBoardRow?.rank != null ? <CountNumber value={myBoardRow.rank} /> : "-"}
                </p>
              </div>
              <div className="dg-well p-3">
                <p className="text-xs text-steel-400">전투 점수</p>
                <p className="font-num text-4xl font-black text-white">
                  <CountNumber value={myBoardRow?.score ?? 0} />
                </p>
              </div>
              <div className="dg-well p-3">
                <p className="text-xs text-steel-400">주간 운동</p>
                <p className="font-num text-4xl font-black text-green-300">
                  <CountNumber value={myWeeklyWorkout} />회
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-steel-200">
                <span>출석 게이지</span>
                <span className="font-num text-base font-black">{attendanceGauge.toFixed(1)}%</span>
              </div>
              <SegGauge value={attendanceGauge} on="bg-plate-blue" />
              <div className="flex items-center justify-between text-xs font-semibold text-steel-200">
                <span>주간 연속 페이스</span>
                <span className="font-num text-base font-black">{myWeeklyWorkout}/7</span>
              </div>
              {/* 주 7일을 7칸으로: 운동한 날만큼 칸이 켜진다 */}
              <SegGauge value={weeklyGauge} cells={7} on="bg-plate-green" />
            </div>
          </article>

          <article className="dg-steel dg-rise p-5" style={{ animationDelay: "80ms" }}>
            <p className="text-sm font-bold text-orange-300">오늘의 미션</p>
            <h3 className="font-display mt-1 text-xl text-white">즉시 수행 미션</h3>
            <p className="dg-whiteboard mt-3 px-4 py-2 text-sm font-bold">{missionLabel}</p>
            <div className="dg-well mt-4 p-3">
              <p className="text-xs font-semibold text-steel-300">라이벌 압박도</p>
              <div className="mt-2">
                <SegGauge value={chasePressure} on="bg-plate-red" />
              </div>
              <p className="mt-2 text-xs text-steel-300">{rivalRow ? `${rivalRow.nickname}까지 ${chaseGap}점` : "현재 최상위권 유지 중"}</p>
            </div>
            <div className="mt-3 flex items-center justify-between rounded border-2 border-black bg-plate-green px-3 py-2 text-white shadow-sm">
              <span className="text-xs font-bold">미션 목표 점수<span className="block font-normal opacity-80">참고용 · 경험치로 지급되지 않아요</span></span>
              <span className="font-num text-2xl font-black"><CountNumber value={questReward} />점</span>
            </div>
          </article>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr]">
          <div className="dg-steel p-5">
            <h3 className="font-display text-lg">왕 타이틀</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {detail.kingTitles?.map((king, idx) => (
                <div
                  key={king.title}
                  className={`dg-well dg-plate-in border-l-[6px] p-3 ${kingStyleByTitle[king.title]?.className ?? "border-l-steel-500"}`}
                  style={{ animationDelay: `${idx * 90}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-num inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-steel-700 text-xs font-black text-chalk">{kingStyleByTitle[king.title]?.icon ?? "K"}</span>
                    <p className="text-xs font-bold text-steel-200">{king.title}</p>
                  </div>
                  <p className="mt-2 text-sm font-bold text-white">{king.nickname}</p>
                  <p className="text-xs text-steel-300">{king.metric}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="dg-steel p-5">
            <h3 className="font-display text-lg">빠른 챌린지 현황</h3>
            <div className="mt-3 space-y-2">
              {detail.challenges.slice(0, 3).map((challenge, idx) => (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => {
                    switchTab("challenges");
                    setExpandedChallengeId(challenge.id);
                  }}
                  className="dg-rise group w-full rounded-md border-2 border-black bg-steel-900 p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:bg-steel-800 hover:shadow-sm"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{challenge.title}</p>
                    <span className={`dg-chip text-xs ${challengeStatusClass[challenge.status]}`}>{challengeStatusText[challenge.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-steel-400">{challenge.startDate} ~ {challenge.endDate}</p>
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
    const top3 = (detail.competitionBoard ?? []).slice(0, 3);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
            {top3.map((row, idx) => {
              const avatar = resolveAvatarConfig(detail.members.find((m) => m.userId === row.userId) ?? null, row.attendanceRate);
              return (
                <article
                  key={row.userId}
                  className={`dg-steel dg-rise dg-lift p-4 ${row.rank === 1 ? "border-t-[8px] border-t-plate-yellow" : ""}`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-num dg-plate-in grid h-10 w-10 place-items-center rounded-full border-[3px] border-black text-lg font-black shadow-sm ${RANK_PLATE[row.rank] ?? "bg-steel-700 text-chalk"}`}
                      style={{ "--from": "-30px", animationDelay: `${idx * 80 + 120}ms` } as CSSProperties}
                    >
                      {row.rank}
                    </span>
                    <span className="font-num text-2xl font-black text-plate-yellow">
                      <CountNumber value={row.score} />
                      <span className="ml-0.5 text-sm text-steel-400">점</span>
                    </span>
                  </div>
                  <div className="mt-2 flex justify-center">
                    <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} tank={avatar.tank} pumped={avatar.pumped} size={78} rank={row.rank} />
                  </div>
                  <p className="mt-2 text-center font-bold">{row.nickname}{renderRankDelta(row.userId)}</p>
                  <p className="text-center text-xs text-steel-300">출석 {row.attendanceRate}% · 주간 {row.recentWorkoutDays}회</p>
                </article>
              );
            })}
        </div>

        <div className="dg-steel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <input
              value={boardQuery}
              onChange={(e) => setBoardQuery(e.target.value)}
              placeholder="닉네임 검색"
              className={`w-full ${FIELD}`}
            />
            <span className="dg-chip whitespace-nowrap bg-steel-700 text-sm text-chalk">
              {filteredBoard.length}명
            </span>
          </div>
          <div className="md:hidden space-y-2 max-h-[56vh] overflow-y-auto pr-1">
            {filteredBoard.map((row, idx) => {
              const animated = animatedRows.includes(row.userId);
              return (
                <div
                  key={`m-${row.userId}`}
                  className={`dg-well dg-rise p-3 ${animated ? "border-plate-yellow" : ""} ${rankMotionClass(row.userId)}`}
                  style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold text-white">
                      {RANK_PLATE[row.rank] ? (
                        <span className={`font-num grid h-7 w-7 place-items-center rounded-full border-2 border-black text-sm font-black ${RANK_PLATE[row.rank]}`}>{row.rank}</span>
                      ) : (
                        <span className="font-num w-7 text-center text-lg font-black text-steel-500">{row.rank}</span>
                      )}
                      {row.nickname}{renderRankDelta(row.userId)}
                    </p>
                    <p className="font-num text-xl font-black text-plate-yellow">{row.score}점</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded border-2 border-black bg-steel-800 px-2 py-1 text-center">
                      <p className="text-steel-400">주간</p>
                      <p className="font-num text-base font-black text-green-300">{row.recentWorkoutDays}회</p>
                    </div>
                    <div className="rounded border-2 border-black bg-steel-800 px-2 py-1 text-center">
                      <p className="text-steel-400">출석률</p>
                      <p className="font-num text-base font-black">{row.attendanceRate}%</p>
                    </div>
                    <div className="rounded border-2 border-black bg-steel-800 px-2 py-1 text-center">
                      <p className="text-steel-400">최근점수</p>
                      <p className="font-num text-base font-black text-plate-yellow">{row.recentScore}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-[46px_1fr_58px_64px_62px] rounded border-2 border-black bg-steel-900 px-3 py-2 text-xs font-bold text-steel-300 sm:grid-cols-[56px_1fr_90px_96px_80px]">
              <span>순위</span><span>닉네임</span><span>주간</span><span>출석률</span><span>점수</span>
            </div>
            <div className="mt-1 max-h-80 space-y-1 overflow-y-auto">
              {filteredBoard.map((row, idx) => {
                const animated = animatedRows.includes(row.userId);
                return (
                  <div
                    key={row.userId}
                    className={`dg-rise grid grid-cols-[46px_1fr_58px_64px_62px] items-center rounded border-2 px-3 py-2 text-sm transition-colors hover:bg-steel-700 sm:grid-cols-[56px_1fr_90px_96px_80px] ${row.rank <= 3 ? "bg-steel-700/70" : "bg-steel-900"} ${animated ? "border-plate-yellow" : "border-black"} ${rankMotionClass(row.userId)}`}
                    style={{ animationDelay: `${Math.min(idx, 14) * 40}ms` }}
                  >
                    <span className="flex items-center">
                      {RANK_PLATE[row.rank] ? (
                        <span className={`font-num grid h-7 w-7 place-items-center rounded-full border-2 border-black text-sm font-black ${RANK_PLATE[row.rank]}`}>{row.rank}</span>
                      ) : (
                        <span className="font-num text-lg font-black text-steel-400">{row.rank}</span>
                      )}
                      {renderRankDelta(row.userId)}
                    </span>
                    <div>
                      <p className="font-semibold">{row.nickname}</p>
                      <p className="text-xs text-steel-400">출석 {row.attendanceScore} + 도전 {row.challengeScore} + 최근 {row.recentScore}{row.bonusScore > 0 ? ` + 보너스 ${row.bonusScore}` : ""}</p>
                    </div>
                    <span className="font-num font-bold text-green-300">{row.recentWorkoutDays}회</span>
                    <span className="font-num font-bold">{row.attendanceRate}%</span>
                    <span className="font-num text-xl font-black text-plate-yellow"><CountNumber value={row.score} /></span>
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
          <div className="dg-well p-3 md:hidden">
            <p className="mb-2 text-xs font-bold text-steel-300">스와이프 챌린지 카드</p>
            <div
              className="select-none rounded-md border-[3px] border-black bg-steel-800 p-3 transition-transform duration-200 ease-out"
              style={{
                transform: `translateX(${challengeDragX}px) rotate(${challengeDragX / 38}deg) scale(${1 - Math.min(0.05, Math.abs(challengeDragX) / 720)})`,
                transition: isChallengeDragging
                  ? "none"
                  : isChallengeAnimating
                  ? "transform 340ms cubic-bezier(0.18, 0.8, 0.24, 1.15)"
                  : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                boxShadow: isChallengeAnimating ? "0 6px 0 var(--dg-ink)" : "0 3px 0 var(--dg-ink)",
              }}
              onTouchStart={(e) => onChallengeSwipeStart(e.touches[0].clientX)}
              onTouchMove={(e) => onChallengeSwipeMove(e.touches[0].clientX)}
              onTouchEnd={(e) => onChallengeSwipeEnd(e.changedTouches[0].clientX)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{activeChallenge.title}</p>
                <span className={`dg-chip text-xs ${challengeStatusClass[activeChallenge.status]}`}>
                  {challengeStatusText[activeChallenge.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-steel-400">{activeChallenge.startDate} ~ {activeChallenge.endDate}</p>
              <p className="mt-1 text-xs font-semibold text-green-300">목표 {activeChallenge.targetWorkoutDays}일</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => moveChallengeFocus("prev")} className="dg-btn dg-btn-steel min-h-[30px] px-2.5 text-xs">이전</button>
              <p className="font-num text-sm font-bold text-steel-300">{activeChallengeIndex + 1} / {challenges.length}</p>
              <button type="button" onClick={() => moveChallengeFocus("next")} className="dg-btn dg-btn-steel min-h-[30px] px-2.5 text-xs">다음</button>
            </div>
          </div>
        )}
        {detail.leader && manageMode && (
          <form onSubmit={onCreateChallenge} className="dg-steel dg-pop space-y-3 border-t-[8px] border-t-plate-red p-4">
            <h3 className="font-display text-lg">챌린지 만들기</h3>
            <input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} placeholder="챌린지 제목" className={`w-full ${FIELD}`} />
            <textarea value={challengeDescription} onChange={(e) => setChallengeDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className={`w-full ${FIELD}`} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input type="date" value={challengeStartDate} onChange={(e) => setChallengeStartDate(e.target.value)} className={FIELD} />
              <input type="date" value={challengeEndDate} onChange={(e) => setChallengeEndDate(e.target.value)} className={FIELD} />
              <input type="number" min={1} max={31} value={challengeTargetDays} onChange={(e) => setChallengeTargetDays(Number(e.target.value))} className={FIELD} />
            </div>
            <button type="submit" className="dg-btn dg-btn-primary min-h-[44px] px-4 text-sm">챌린지 생성</button>
          </form>
        )}

        <div className="space-y-3">
          {detail.challenges.length === 0 && <p className="text-sm text-steel-400">등록된 챌린지가 없습니다.</p>}
          {detail.challenges.map((challenge, cIdx) => {
            const topMember = challenge.members[0];
            const isExpanded = expandedChallengeId === challenge.id;
            const isEditing = editingChallengeId === challenge.id;
            const avgCompletion = challenge.members.length
              ? challenge.members.reduce((sum, m) => sum + m.completionRate, 0) / challenge.members.length
              : 0;
            return (
              <article
                key={challenge.id}
                className={`dg-steel dg-rise border-l-[8px] p-4 ${
                  challenge.status === "ONGOING" ? "border-l-plate-green" : challenge.status === "UPCOMING" ? "border-l-plate-blue" : "border-l-steel-600"
                }`}
                style={{ animationDelay: `${Math.min(cIdx, 8) * 60}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)} className="text-left">
                    <div className="flex items-center gap-2">
                      <strong>{challenge.title}</strong>
                      <span className={`dg-chip text-xs ${challengeStatusClass[challenge.status]}`}>{challengeStatusText[challenge.status]}</span>
                    </div>
                    <p className="mt-1 text-xs text-steel-400">{challenge.startDate} ~ {challenge.endDate} · 목표 {challenge.targetWorkoutDays}일</p>
                  </button>
                  <div className="flex items-center gap-2">
                    {detail.leader && manageMode && <><button type="button" onClick={() => startEditChallenge(challenge)} className="dg-btn dg-btn-steel min-h-[30px] px-2.5 text-xs">수정</button><button type="button" onClick={() => void onDeleteChallenge(challenge.id)} className="dg-btn min-h-[30px] bg-steel-900 px-2.5 text-xs text-red-300 hover:bg-plate-red hover:text-white">삭제</button></>}
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)}
                      className="dg-btn dg-btn-steel min-h-[30px] px-2.5 text-xs"
                    >
                      <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      {isExpanded ? "접기" : "펼치기"}
                    </button>
                  </div>
                </div>
                {challenge.description && <p className="mt-2 text-sm text-steel-300">{challenge.description}</p>}
                {challenge.members.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-steel-300">
                      <span>모임 평균 완료율</span>
                      <span className="font-num text-base font-black text-plate-yellow">{Math.round(avgCompletion)}%</span>
                    </div>
                    <SegGauge value={avgCompletion} on="bg-plate-yellow" />
                  </div>
                )}
                {topMember && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded border-2 border-black bg-steel-900 px-3 py-2 text-xs text-steel-200">
                    <span className="font-num grid h-6 w-6 place-items-center rounded-full border-2 border-black bg-plate-yellow text-xs font-black text-black">1</span>
                    현재 1위: <strong className="text-white">{topMember.nickname}</strong> · {topMember.completionRate}% ({topMember.workoutDays}/{topMember.targetWorkoutDays})
                  </div>
                )}

                {isExpanded && (
                  <div className="dg-rise mt-3 space-y-3">
                    {isEditing && detail.leader && manageMode && (
                      <form onSubmit={submitEditChallenge} className="dg-pop space-y-2 rounded-md border-2 border-dashed border-plate-yellow bg-steel-900 p-3">
                        <p className="text-sm font-bold text-plate-yellow">챌린지 수정</p>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="챌린지 제목" className={`w-full ${FIELD}`} />
                        <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className={`w-full ${FIELD}`} />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className={FIELD} /><input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className={FIELD} /><input type="number" min={1} max={31} value={editTargetDays} onChange={(e) => setEditTargetDays(Number(e.target.value))} className={FIELD} /></div>
                        <div className="flex gap-2"><button type="submit" className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">저장</button><button type="button" onClick={() => setEditingChallengeId(null)} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">취소</button></div>
                      </form>
                    )}
                    <div className="grid gap-2 md:grid-cols-2">
                      {challenge.members.map((member, index) => {
                        const avatar = resolveAvatarConfig(member as any, member.completionRate);
                        const cells = member.targetWorkoutDays > 0 && member.targetWorkoutDays <= 14 ? member.targetWorkoutDays : 10;
                        return (
                          <div
                            key={`${challenge.id}-${member.userId}`}
                            className="dg-well dg-rise p-3 text-sm"
                            style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
                          >
                            <div className="flex items-center gap-3">
                              <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} tank={avatar.tank} pumped={avatar.pumped} size={48} rank={index + 1} badge={member.badge} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{member.nickname}</span>
                                  <span className="font-num text-lg font-black text-plate-yellow">{member.completionRate}%</span>
                                </div>
                                {/* 목표 일수만큼 칸: 운동한 날마다 한 칸씩 */}
                                <div className="mt-1.5">
                                  <SegGauge value={member.completionRate} cells={cells} on="bg-plate-green" />
                                </div>
                                <p className="font-num mt-1 text-sm font-bold text-steel-400">{member.workoutDays}/{member.targetWorkoutDays}</p>
                              </div>
                            </div>
                          </div>
                        );
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
    const sortTabs: { key: "rank" | "weekly" | "attendance"; label: string }[] = [
      { key: "rank", label: "순위순" },
      { key: "weekly", label: "주간 운동순" },
      { key: "attendance", label: "출석률순" },
    ];
    return (
      <div className="space-y-3">
        <div className="dg-well p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="멤버 닉네임 검색"
              className="rounded border-2 border-black bg-steel-800 px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
            />
            {/* 정렬: 누르면 눌린 칩으로 바뀐다 (select 와 같은 값을 쓴다) */}
            <div className="flex gap-1.5" role="group" aria-label="정렬">
              {sortTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={memberSort === tab.key}
                  onClick={() => setMemberSort(tab.key)}
                  className={`rounded border-2 border-black px-3 py-2 text-xs font-bold transition-all duration-100 ${
                    memberSort === tab.key
                      ? "translate-y-[2px] bg-plate-yellow text-black"
                      : "bg-steel-700 text-steel-200 shadow-sm hover:-translate-y-0.5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="dg-chip justify-center bg-steel-700 text-sm text-chalk">
              {membersWithBoardMeta.length}명
            </div>
          </div>
        </div>

        <div className="md:hidden space-y-2">
          {visibleMembers.map(({ member, board }, idx) => {
            const avatar = resolveAvatarConfig(member as any, member.attendanceRate);
            const memberRank = board?.rank ?? "-";
            const weeklyWorkout = board?.recentWorkoutDays ?? 0;
            return (
              <article
                key={`mobile-${member.userId}`}
                className="dg-well dg-rise p-3"
                style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} tank={avatar.tank} pumped={avatar.pumped} size={42} />
                    <div>
                      <p className="text-sm font-semibold">{member.nickname}</p>
                      <p className="text-xs text-steel-400"><span className="font-num font-bold">#{memberRank}</span> · {CREW_ROLE_LABEL[member.role] ?? member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-steel-400">이번주</p>
                    <p className="font-num text-lg font-black text-green-300">{weeklyWorkout}회</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-steel-400">출석률 {member.attendanceRate}% · {member.workoutDays}/{member.targetDays}</p>
              </article>
            );
          })}
        </div>

        <div className="hidden md:grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleMembers.map(({ member, board }, idx) => {
          const avatar = resolveAvatarConfig(member as any, member.attendanceRate);
          const memberRank = board?.rank ?? "-";
          const weeklyWorkout = board?.recentWorkoutDays ?? 0;
          return (
            <article
              key={member.userId}
              className="dg-lift dg-rise rounded-xl border-[3px] border-black bg-steel-800 p-4 shadow-md"
              style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
            >
              <div className="flex items-center gap-3">
                <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} gender={avatar.gender} isResting={avatar.isResting} tank={avatar.tank} pumped={avatar.pumped} size={60} />
                <div>
                  <p className="font-semibold">{member.nickname}</p>
                  <p className="text-xs text-steel-400"><span className="font-num text-sm font-bold">#{memberRank}</span> · {CREW_ROLE_LABEL[member.role] ?? member.role}</p>
                  {member.characterLevel != null && <p className="font-num text-sm font-bold text-plate-yellow">Lv.{member.characterLevel}</p>}
                </div>
              </div>
              <div className="mt-3">
                <SegGauge value={member.attendanceRate} on="bg-plate-blue" />
              </div>
              <p className="mt-2 text-xs text-steel-400">출석률 {member.attendanceRate}% · {member.workoutDays}/{member.targetDays}</p>
              <p className="mt-1 text-xs font-semibold text-green-300">이번주 운동 {weeklyWorkout}회</p>
              {detail.leader && manageMode && member.role !== "OWNER" && (member.role !== "STAFF" || detail.myRole === "OWNER") && <button type="button" onClick={() => void onKickMember(member.userId)} className="dg-btn mt-3 min-h-[30px] bg-steel-900 px-2.5 text-xs text-red-300 hover:bg-plate-red hover:text-white">강퇴</button>}
            </article>
          );
        })}
        </div>
        {memberVisibleCount < membersWithBoardMeta.length && (
          <button
            type="button"
            onClick={() => setMemberVisibleCount((prev) => prev + 24)}
            className="dg-btn dg-btn-steel w-full text-sm"
          >
            멤버 더 보기 (+24)
          </button>
        )}
      </div>
    );
  };

  const tabItems: { key: ViewTab; label: string; short: string }[] = [
    { key: "dashboard", label: "대시보드", short: "대시" },
    { key: "challenges", label: "챌린지", short: "챌린지" },
    { key: "leaderboard", label: "리더보드", short: "랭킹" },
    { key: "members", label: "멤버", short: "멤버" },
  ];
  const activeTabIndex = Math.max(0, TAB_ORDER.indexOf(activeTab));

  return (
    <section className="relative min-h-screen overflow-hidden pb-28 pt-24 text-white">
      <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6 lg:px-10">
        <div className="dg-steel relative overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-plate-yellow">운동 모임 챌린지</p>
              <h1 className="text-2xl text-white sm:text-3xl">{detail?.name || "모임 챌린지"}</h1>
              <p className="text-xs text-steel-300">{nextGoal}</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              <Link to="/crew" className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm">모임 허브</Link>
              <Link to={`/crew/${crewIdNum}/lobby`} className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm">로비</Link>
              <Link to={`/crew/${crewIdNum}/highlights`} className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm">하이라이트</Link>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${FIELD} col-span-2 sm:col-span-1`} />
            </div>
          </div>
        </div>

        <div className="sticky top-20 z-30 rounded-xl border-[3px] border-black bg-steel-800 p-3 shadow-xl">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="dg-well p-3">
              <p className="text-xs text-steel-400">내 캐릭터</p>
              <div className="mt-1 flex items-center gap-2">
                <EnhancedAvatar seed={myAvatar.seed} tier={myAvatar.tier} stage={myAvatar.stage} gender={myAvatar.gender} isResting={myAvatar.isResting} tank={myAvatar.tank} pumped={myAvatar.pumped} size={38} />
                <p className="text-sm font-semibold">{myAttendanceRow?.nickname ?? "-"}</p>
              </div>
            </div>
            <div className="dg-well p-3">
              <p className="text-xs text-steel-400">현재 순위</p>
              <p key={myBoardRow?.rank ?? "none"} className="dg-pop font-num text-3xl font-black text-plate-yellow">#{myBoardRow?.rank ?? "-"}</p>
            </div>
            <div className="dg-well p-3">
              <p className="text-xs text-steel-400">활성 챌린지</p>
              <p className="font-num text-3xl font-black"><CountNumber value={ongoingChallengeCount} /></p>
            </div>
            <div className="dg-well border-l-[6px] border-l-orange-500 p-3">
              <p className="text-xs text-steel-400">이번주 스프린트</p>
              <p className="text-sm font-black text-orange-300">주간 운동 {myWeeklyWorkout}회</p>
              <p className="mt-1 text-xs text-steel-300">
                {rivalRow ? `다음 목표 ${rivalRow.nickname} · ${chaseGap}점 차이` : missionLabel}
              </p>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="dg-well border-l-[6px] border-l-plate-red p-3">
              <p className="flex items-center gap-1.5 text-xs text-steel-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-red-300" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M6 11l6-6 6 6" />
                </svg>
                내 바로 위 라이벌
              </p>
              {rivalRow ? (
                <>
                  <p className="mt-1 text-sm font-black text-white">{rivalRow.nickname}</p>
                  <p className="text-xs text-steel-300">#{rivalRow.rank} · 주간 {rivalRow.recentWorkoutDays}회 · {chaseGap}점 차이</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-steel-300">현재 1위입니다. 방어 모드 유지!</p>
              )}
            </div>
            <div className="dg-well border-l-[6px] border-l-plate-green p-3">
              <p className="flex items-center gap-1.5 text-xs text-steel-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-green-300" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
                내 바로 아래 추격자
              </p>
              {trailingRow ? (
                <>
                  <p className="mt-1 text-sm font-black text-white">{trailingRow.nickname}</p>
                  <p className="text-xs text-steel-300">#{trailingRow.rank} · 주간 {trailingRow.recentWorkoutDays}회 · {defendGap}점 차이</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-steel-300">추격자 없음. 페이스 유지!</p>
              )}
            </div>
          </div>
        </div>

        {/* 데스크톱 탭: 빨간 밑줄이 선택한 탭으로 미끄러진다 */}
        <div className="relative hidden grid-cols-4 border-b-2 border-steel-700 md:grid" role="tablist">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => switchTab(tab.key)}
              className={`px-4 pb-2.5 pt-1 text-base font-bold transition-colors ${
                activeTab === tab.key ? "text-white" : "text-steel-400 hover:text-steel-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span
            aria-hidden
            className="absolute -bottom-[2px] left-0 h-1 w-1/4 bg-plate-red transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
          />
        </div>

        {error && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{error}</p>}
        {!detail && (
          <div className="dg-steel flex items-center gap-3 p-6 text-steel-300">
            <span className="dg-loading-plates" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
            불러오는 중...
          </div>
        )}

        {detail && (
          <>
            <div className="dg-steel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <input value={detail.name} onChange={(e) => setDetail((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className={`${FIELD} font-display text-xl`} />
                  <textarea value={detail.description ?? ""} onChange={(e) => setDetail((prev) => (prev ? { ...prev, description: e.target.value } : prev))} rows={2} className={`w-full ${FIELD} text-steel-200`} />
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
                      className={FIELD}
                    >
                      <option value="AUTO_APPROVE">가입 방식: 즉시 참여</option>
                      <option value="LEADER_APPROVE">가입 방식: 방장 승인 필요</option>
                    </select>
                  )}
                  {/* 초대 코드는 모임원에게만 온다(모임원이 아니면 null) */}
                  {detail.memberDetailVisible === false && (
                    <div className="dg-well px-3 py-2 text-xs text-steel-300">
                      <p className="font-semibold text-chalk">모임에 참여하면 멤버별 출석 기록을 볼 수 있어요.</p>
                      <p className="mt-1">
                        멤버 {detail.memberCount ?? 0}명 · 이번 달 운동 합계 {detail.monthWorkoutTotal ?? 0}회 · 평균 출석률 {Math.round(detail.averageAttendanceRate ?? 0)}%
                      </p>
                    </div>
                  )}
                  {detail.inviteCode && (
                  <div className="flex items-center gap-2 text-xs text-steel-300">
                    <span>초대코드: <span className="font-num text-base font-black text-plate-yellow">{detail.inviteCode}</span></span>
                    <button
                      type="button"
                      onClick={() => void copyInviteLink()}
                      className={`dg-btn dg-chalk-burst min-h-[30px] px-2.5 text-xs ${copiedLink ? "bg-plate-green text-white" : "bg-steel-700 text-chalk"}`}
                    >
                      <span key={copiedLink ? "done" : "idle"} className="dg-pop inline-block">{copiedLink ? "복사됨" : "링크 복사"}</span>
                    </button>
                  </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.joined ? <button type="button" onClick={() => void onLeave()} className="dg-btn min-h-[40px] bg-steel-900 px-3 text-sm text-red-300 hover:bg-plate-red hover:text-white">모임 탈퇴</button> : <button type="button" onClick={() => void onJoin()} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">모임 참여</button>}
                  {detail.leader && <><button type="button" aria-pressed={manageMode} onClick={() => setManageMode((prev) => !prev)} className={`dg-btn min-h-[40px] px-3 text-sm ${manageMode ? "bg-plate-yellow text-black" : "dg-btn-steel"}`}>{manageMode ? "관리 모드 켜짐" : "관리 모드"}</button>{manageMode && detail.myRole === "OWNER" && <><button type="button" onClick={() => void onUpdateCrew()} className="dg-btn dg-btn-steel dg-pop min-h-[40px] px-3 text-sm">모임 수정</button><button type="button" onClick={() => void onDeleteCrew()} className="dg-btn dg-pop min-h-[40px] bg-steel-900 px-3 text-sm text-red-300 hover:bg-plate-red hover:text-white">모임 삭제</button></>}</>}
                </div>
              </div>
            </div>

            {detail.leader && manageMode && (
              <div className="dg-steel dg-pop border-t-[8px] border-t-plate-yellow p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">가입 신청 관리</h3>
                  <span className="dg-chip bg-plate-yellow text-xs text-black">대기 {joinRequests.length}건</span>
                </div>
                {joinRequestLoading && (
                  <p className="flex items-center gap-2 text-xs text-steel-300">
                    <span className="dg-loading-plates" aria-label="불러오는 중">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    불러오는 중...
                  </p>
                )}
                {!joinRequestLoading && joinRequests.length === 0 && (
                  <p className="text-xs text-steel-300">현재 대기 중인 가입 신청이 없습니다.</p>
                )}
                <div className="space-y-2">
                  {joinRequests.map((request, idx) => (
                    <div
                      key={request.id}
                      className="dg-well dg-rise flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{request.nickname}</p>
                        {displayEmail(request.email) && <p className="truncate text-xs text-steel-400">{displayEmail(request.email)}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onApproveJoinRequest(request.id)}
                          className="dg-btn dg-chalk-burst min-h-[30px] bg-plate-green px-3 text-xs text-white"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRejectJoinRequest(request.id)}
                          className="dg-btn dg-btn-steel min-h-[30px] px-3 text-xs"
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
        {/* 모바일 탭: 빨간 받침이 선택한 탭으로 미끄러진다 */}
        <div className="relative grid grid-cols-4 gap-0 rounded-lg border-[3px] border-black bg-steel-800 p-1.5 shadow-xl">
          <span
            aria-hidden
            className="absolute bottom-1.5 left-1.5 top-1.5 rounded border-2 border-black bg-plate-red transition-transform duration-300 ease-out"
            style={{ width: "calc((100% - 0.75rem) / 4)", transform: `translateX(${activeTabIndex * 100}%)` }}
          />
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={activeTab === tab.key}
              onClick={() => switchTab(tab.key)}
              className={`touch-manipulation relative z-10 rounded py-2 text-xs font-bold transition-colors ${
                activeTab === tab.key ? "text-white" : "text-steel-300"
              }`}
            >
              {tab.short}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes crewTabSlideInRight{from{opacity:.35;transform:translate3d(22px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
        @keyframes crewTabSlideInLeft{from{opacity:.35;transform:translate3d(-22px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
        @keyframes crewRankRise{0%{transform:translateY(0);box-shadow:0 0 0 0 var(--dg-green)}35%{transform:translateY(-3px);box-shadow:0 0 0 3px var(--dg-green)}100%{transform:translateY(0);box-shadow:0 0 0 0 var(--dg-green)}}
        @keyframes crewRankFall{0%{transform:translateY(0);box-shadow:0 0 0 0 var(--dg-red)}35%{transform:translateY(3px);box-shadow:0 0 0 3px var(--dg-red)}100%{transform:translateY(0);box-shadow:0 0 0 0 var(--dg-red)}}
        .crew-rank-rise{animation:crewRankRise .9s ease-out}
        .crew-rank-fall{animation:crewRankFall .9s ease-out}
      `}</style>
    </section>
  );
}
