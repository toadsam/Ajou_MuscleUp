import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { crewApi } from "../services/crewApi";
import type { CrewChallenge, CrewDetail } from "../types/crew";

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

type LocalUser = { nickname?: string };

type AvatarRow = {
  userId: number;
  nickname: string;
  attendanceRate?: number;
  characterTier?: CharacterTier | null;
  characterStage?: number | null;
  avatarSeed?: string | null;
};

const resolveAvatarConfig = (row: AvatarRow | null | undefined, fallbackRate = 0) => {
  const tier = (row?.characterTier ?? tierFromAttendance(row?.attendanceRate ?? fallbackRate)) as CharacterTier;
  const stage = row?.characterStage ?? Math.max(1, Math.min(9, Math.floor((row?.attendanceRate ?? fallbackRate) / 12)));
  const seed = row?.avatarSeed ?? `crew-avatar-${row?.userId ?? "x"}-${row?.nickname ?? "unknown"}`;
  return { tier, stage, seed };
};

function EnhancedAvatar({ seed, tier, stage, size, rank, badge }: { seed: string; tier: CharacterTier; stage: number; size: number; rank?: number; badge?: string }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${tierAuraClass[tier]} blur-md`} />
      {rank && rank <= 3 && <span className="absolute -top-3 z-20 rounded-full border border-yellow-200/70 bg-yellow-300 px-1.5 py-0.5 text-[10px] font-black text-slate-900">{rank === 1 ? "CROWN" : `TOP${rank}`}</span>}
      <div className="relative z-10 rounded-xl border border-white/15 bg-slate-900/70 p-1">
        <AvatarRenderer avatarSeed={seed} tier={tier} stage={stage} size={size} />
      </div>
      {badge && <span className="absolute -bottom-2 z-20 rounded-full border border-white/30 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">{badge}</span>}
    </div>
  );
}

export default function CrewChallenge() {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const crewIdNum = Number(crewId || 0);

  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [expandedChallengeId, setExpandedChallengeId] = useState<number | null>(null);

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
  const previousRanksRef = useRef<Record<number, number>>({});

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
      await crewApi.join(crewIdNum);
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

  const renderLeaderboard = () => {
    if (!detail) return null;
    const top3 = detail.competitionBoard.slice(0, 3);
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[560px] grid-cols-3 gap-3 md:min-w-0">
            {top3.map((row) => {
              const avatar = resolveAvatarConfig(detail.members.find((m) => m.userId === row.userId) ?? null, row.attendanceRate);
              return (
                <article key={row.userId} className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-300 px-2 py-1 text-xs font-bold text-slate-900">#{row.rank}</span>
                    <span className="text-xs text-amber-100">{row.score}점</span>
                  </div>
                  <div className="mt-2 flex justify-center">
                    <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={78} rank={row.rank} />
                  </div>
                  <p className="mt-2 text-center font-bold">{row.nickname}{renderRankDelta(row.userId)}</p>
                  <p className="text-center text-xs text-amber-100/80">출석 {row.attendanceRate}%</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-[56px_1fr_90px_96px] rounded-lg bg-white/5 px-3 py-2 text-[11px] text-gray-300">
            <span>순위</span><span>닉네임</span><span>출석률</span><span>점수</span>
          </div>
          <div className="mt-1 max-h-80 space-y-1 overflow-y-auto">
            {detail.competitionBoard.map((row) => {
              const animated = animatedRows.includes(row.userId);
              return (
                <div key={row.userId} className={`grid grid-cols-[56px_1fr_90px_96px] rounded-lg px-3 py-2 text-sm transition-all ${row.rank <= 3 ? "bg-amber-500/5" : "bg-black/15"} ${animated ? "ring-1 ring-cyan-300/60" : ""}`}>
                  <span className="text-cyan-200">#{row.rank}{renderRankDelta(row.userId)}</span>
                  <div>
                    <p className="font-semibold">{row.nickname}</p>
                    <p className="text-[11px] text-gray-400">출석 {row.attendanceScore} + 도전 {row.challengeScore} + 최근 {row.recentScore}{row.bonusScore > 0 ? ` + 보너스 ${row.bonusScore}` : ""}</p>
                  </div>
                  <span>{row.attendanceRate}%</span>
                  <span className="font-semibold text-amber-200">{row.score}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderChallenges = () => {
    if (!detail) return null;
    return (
      <div className="space-y-4">
        {detail.leader && (
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
                    {detail.leader && <><button type="button" onClick={() => startEditChallenge(challenge)} className="rounded-lg border border-cyan-300/40 px-2 py-1 text-xs text-cyan-200">수정</button><button type="button" onClick={() => void onDeleteChallenge(challenge.id)} className="rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-300">삭제</button></>}
                    <button type="button" onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)} className="rounded-lg border border-white/20 px-2 py-1 text-xs text-gray-200">{isExpanded ? "접기" : "펼치기"}</button>
                  </div>
                </div>
                {challenge.description && <p className="mt-2 text-sm text-gray-300">{challenge.description}</p>}
                {topMember && <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">현재 1위: <strong>{topMember.nickname}</strong> · {topMember.completionRate}% ({topMember.workoutDays}/{topMember.targetWorkoutDays})</div>}

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {isEditing && detail.leader && (
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
                        return <div key={`${challenge.id}-${member.userId}`} className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm"><div className="flex items-center gap-2"><EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={48} rank={index + 1} badge={member.badge} /><div className="flex-1"><div className="flex items-center justify-between"><span>{member.nickname}</span><span className="text-cyan-300">{member.completionRate}%</span></div><p className="mt-1 text-xs text-gray-400">{member.workoutDays}/{member.targetWorkoutDays}</p></div></div></div>;
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
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {detail.members.map((member, idx) => {
          const avatar = resolveAvatarConfig(member as any, member.attendanceRate);
          return (
            <article key={member.userId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <EnhancedAvatar seed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={60} rank={idx + 1} />
                <div>
                  <p className="font-semibold">{member.nickname}</p>
                  <p className="text-xs text-gray-400">#{idx + 1} · {member.role}</p>
                  {member.characterLevel != null && <p className="text-[11px] text-cyan-200">Lv.{member.characterLevel}</p>}
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.min(member.attendanceRate, 100)}%` }} /></div>
              <p className="mt-2 text-xs text-gray-400">출석률 {member.attendanceRate}% · {member.workoutDays}/{member.targetDays}</p>
              {detail.leader && member.role !== "LEADER" && <button type="button" onClick={() => void onKickMember(member.userId)} className="mt-3 rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-300">강퇴</button>}
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-slate-950 pb-28 pt-28 text-white">
      <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-900/35 via-slate-900/60 to-emerald-900/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs tracking-[0.2em] text-cyan-200">CREW CHALLENGE ARENA</p><h1 className="text-2xl font-black">{detail?.name || "모임 챌린지"}</h1><p className="text-xs text-gray-300">{nextGoal}</p></div>
            <div className="flex items-center gap-2"><Link to="/crew" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">모임 허브</Link><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /></div>
          </div>
        </div>

        <div className="sticky top-20 z-30 rounded-2xl border border-cyan-300/25 bg-slate-900/90 p-3 backdrop-blur"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[11px] text-gray-400">내 캐릭터</p><p className="text-sm font-semibold">{myAttendanceRow?.nickname ?? "-"}</p><p className="text-xs text-cyan-200">출석 {myAttendanceRow?.attendanceRate ?? 0}%</p></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[11px] text-gray-400">현재 순위</p><p className="text-xl font-black text-amber-200">#{myBoardRow?.rank ?? "-"}</p></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[11px] text-gray-400">활성 챌린지</p><p className="text-xl font-black">{detail?.challenges.filter((c) => c.status === "ONGOING").length ?? 0}</p></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[11px] text-gray-400">오늘 할 일</p><p className="text-xs text-emerald-200">출석 + 챌린지 1개 확인</p></div></div></div>

        <div className="hidden flex-wrap gap-2 md:flex">{[{ key: "dashboard", label: "대시보드" }, { key: "challenges", label: "챌린지" }, { key: "leaderboard", label: "리더보드" }, { key: "members", label: "멤버" }].map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as ViewTab)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-cyan-400 text-slate-950" : "border border-white/20 bg-black/20 text-gray-200 hover:bg-white/10"}`}>{tab.label}</button>)}</div>

        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {!detail && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-gray-300">불러오는 중...</div>}

        {detail && (<><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-2"><input value={detail.name} onChange={(e) => setDetail((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xl font-extrabold" /><textarea value={detail.description ?? ""} onChange={(e) => setDetail((prev) => (prev ? { ...prev, description: e.target.value } : prev))} rows={2} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-gray-300" /><div className="flex items-center gap-2 text-xs text-cyan-300"><span>초대코드: <span className="font-bold">{detail.inviteCode}</span></span><button type="button" onClick={() => void copyInviteLink()} className="rounded-md border border-cyan-300/40 px-2 py-1 text-cyan-200 hover:bg-cyan-500/10">{copiedLink ? "복사됨" : "링크 복사"}</button></div></div><div className="flex items-center gap-2">{detail.joined ? <button type="button" onClick={() => void onLeave()} className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">모임 탈퇴</button> : <button type="button" onClick={() => void onJoin()} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">모임 참여</button>}{detail.leader && <><button type="button" onClick={() => void onUpdateCrew()} className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">모임 수정</button><button type="button" onClick={() => void onDeleteCrew()} className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">모임 삭제</button></>}</div></div></div>
          {activeTab === "dashboard" && <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h3 className="text-lg font-bold">왕 타이틀</h3><div className="mt-3 grid gap-2 sm:grid-cols-3">{detail.kingTitles?.map((king) => <div key={king.title} className={`rounded-xl border p-3 ${kingStyleByTitle[king.title]?.className ?? "border-white/20 bg-white/10 text-white"} animate-pulse`}><div className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/40 text-xs font-bold">{kingStyleByTitle[king.title]?.icon ?? "K"}</span><p className="text-xs">{king.title}</p></div><p className="mt-2 text-sm font-bold text-white">{king.nickname}</p><p className="text-xs opacity-90">{king.metric}</p></div>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h3 className="text-lg font-bold">빠른 챌린지 현황</h3><div className="mt-3 space-y-2">{detail.challenges.slice(0, 3).map((challenge) => <button key={challenge.id} type="button" onClick={() => { setActiveTab("challenges"); setExpandedChallengeId(challenge.id); }} className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{challenge.title}</p><span className={`rounded-full border px-2 py-0.5 text-[11px] ${challengeStatusClass[challenge.status]}`}>{challengeStatusText[challenge.status]}</span></div><p className="mt-1 text-xs text-gray-400">{challenge.startDate} ~ {challenge.endDate}</p></button>)}</div></div></div>}
          {activeTab === "challenges" && renderChallenges()}
          {activeTab === "leaderboard" && renderLeaderboard()}
          {activeTab === "members" && renderMembers()}</>)}
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden"><div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/15 bg-slate-900/95 p-2 backdrop-blur">{[{ key: "dashboard", label: "대시" }, { key: "challenges", label: "챌린지" }, { key: "leaderboard", label: "랭킹" }, { key: "members", label: "멤버" }].map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as ViewTab)} className={`rounded-xl py-2 text-xs font-semibold ${activeTab === tab.key ? "bg-cyan-400 text-slate-950" : "text-gray-200"}`}>{tab.label}</button>)}</div></div>
    </section>
  );
}
