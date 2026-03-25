import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { crewApi } from "../services/crewApi";
import type { CrewChallenge, CrewDetail, CrewListItem } from "../types/crew";

const currentMonthKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const todayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const plus7Days = () => {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export default function Crew() {
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState<CrewListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [month, setMonth] = useState(currentMonthKey());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedId) ?? null,
    [groups, selectedId]
  );

  const loadGroups = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await crewApi.list();
      setGroups(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (groupId: number, monthKey: string) => {
    try {
      const data = await crewApi.getDetail(groupId, monthKey);
      setDetail(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 상세를 불러오지 못했습니다.");
      setDetail(null);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  useEffect(() => {
    const invite = searchParams.get("invite");
    if (!invite) return;
    setInviteCodeInput(invite.toUpperCase());
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId, month);
  }, [selectedId, month]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const created = await crewApi.create({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      await loadGroups();
      setSelectedId(created.id);
      setDetail(created);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 생성에 실패했습니다.");
    }
  };

  const onJoinByCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setError("");
    try {
      await crewApi.joinByCode(inviteCodeInput.trim().toUpperCase());
      setInviteCodeInput("");
      await loadGroups();
    } catch (e: any) {
      setError(e?.response?.data?.message || "초대코드 참가에 실패했습니다.");
    }
  };

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

  const onJoin = async (groupId: number) => {
    setError("");
    try {
      await crewApi.join(groupId);
      await loadGroups();
      await loadDetail(groupId, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 참가에 실패했습니다.");
    }
  };

  const onLeave = async (groupId: number) => {
    setError("");
    try {
      await crewApi.leave(groupId);
      await loadGroups();
      await loadDetail(groupId, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 탈퇴에 실패했습니다.");
    }
  };

  const onUpdateCrew = async () => {
    if (!detail) return;
    setError("");
    try {
      const updated = await crewApi.update(detail.id, {
        name: detail.name,
        description: detail.description || "",
      });
      setDetail(updated);
      await loadGroups();
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 수정에 실패했습니다.");
    }
  };

  const onDeleteCrew = async () => {
    if (!detail) return;
    if (!window.confirm("모임을 삭제할까요?")) return;
    setError("");
    try {
      await crewApi.remove(detail.id);
      setDetail(null);
      setSelectedId(null);
      await loadGroups();
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 삭제에 실패했습니다.");
    }
  };

  const onKickMember = async (memberUserId: number) => {
    if (!detail) return;
    if (!window.confirm("해당 멤버를 강퇴할까요?")) return;
    setError("");
    try {
      await crewApi.kickMember(detail.id, memberUserId);
      await loadDetail(detail.id, month);
      await loadGroups();
    } catch (e: any) {
      setError(e?.response?.data?.message || "멤버 강퇴에 실패했습니다.");
    }
  };

  const onCreateChallenge = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    setError("");
    try {
      await crewApi.createChallenge(detail.id, {
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
      await loadDetail(detail.id, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "챌린지 생성에 실패했습니다.");
    }
  };

  const onDeleteChallenge = async (challengeId: number) => {
    if (!detail) return;
    if (!window.confirm("챌린지를 삭제할까요?")) return;
    setError("");
    try {
      await crewApi.deleteChallenge(detail.id, challengeId);
      if (editingChallengeId === challengeId) setEditingChallengeId(null);
      await loadDetail(detail.id, month);
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
  };

  const cancelEditChallenge = () => {
    setEditingChallengeId(null);
  };

  const submitEditChallenge = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !editingChallengeId) return;
    setError("");
    try {
      await crewApi.updateChallenge(detail.id, editingChallengeId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        targetWorkoutDays: editTargetDays,
      });
      setEditingChallengeId(null);
      await loadDetail(detail.id, month);
    } catch (e: any) {
      setError(e?.response?.data?.message || "챌린지 수정에 실패했습니다.");
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-10">
        <aside className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-cyan-300">CREW</p>
            <h1 className="mt-1 text-2xl font-extrabold">운동 모임</h1>
            <p className="mt-2 text-sm text-gray-300">챌린지 운영, 랭킹 경쟁, 팀 출석 관리까지 한 화면에서 처리하세요.</p>
          </div>

          <form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-bold">모임 만들기</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="모임 이름" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="모임 소개 (선택)" rows={3} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            <button type="submit" className="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">모임 생성</button>
          </form>

          <form onSubmit={onJoinByCode} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-bold">초대코드 참가</h2>
            <input value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} maxLength={20} placeholder="예: A1B2C3D4" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm uppercase outline-none focus:border-cyan-400" />
            <button type="submit" className="w-full rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200">코드로 참여</button>
          </form>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <h2 className="px-1 text-sm font-semibold text-gray-300">모임 목록</h2>
            {loading && <p className="px-1 py-2 text-sm text-gray-400">불러오는 중...</p>}
            {!loading && groups.length === 0 && <p className="px-1 py-2 text-sm text-gray-400">아직 모임이 없습니다.</p>}
            {groups.map((group) => (
              <button key={group.id} type="button" onClick={() => setSelectedId(group.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === group.id ? "border-cyan-300 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}>
                <div className="flex items-center justify-between gap-2">
                  <strong className="line-clamp-1 text-sm">{group.name}</strong>
                  {group.joined && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-300">참여중</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">{group.description || "소개 없음"}</p>
                <p className="mt-2 text-xs text-gray-500">리더 {group.ownerNickname} · {group.memberCount}명</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-4">
          {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          {!selectedGroup && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-gray-300">왼쪽에서 모임을 선택해주세요.</div>}

          {selectedGroup && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <input value={detail?.name ?? selectedGroup.name} onChange={(e) => setDetail((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xl font-extrabold" />
                  <textarea value={detail?.description ?? selectedGroup.description ?? ""} onChange={(e) => setDetail((prev) => (prev ? { ...prev, description: e.target.value } : prev))} rows={2} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-gray-300" />
                  {detail && (
                    <div className="flex items-center gap-2 text-xs text-cyan-300">
                      <span>초대코드: <span className="font-bold">{detail.inviteCode}</span></span>
                      <button type="button" onClick={() => void copyInviteLink()} className="rounded-md border border-cyan-300/40 px-2 py-1 text-cyan-200 hover:bg-cyan-500/10">
                        {copiedLink ? "복사됨" : "링크 복사"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                  {selectedGroup.joined ? (
                    <button type="button" onClick={() => void onLeave(selectedGroup.id)} className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">모임 탈퇴</button>
                  ) : (
                    <button type="button" onClick={() => void onJoin(selectedGroup.id)} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">모임 참여</button>
                  )}
                  {detail?.leader && (
                    <>
                      <button type="button" onClick={() => void onUpdateCrew()} className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">모임 수정</button>
                      <button type="button" onClick={() => void onDeleteCrew()} className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">모임 삭제</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {detail && (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">월간 출석 랭킹 ({detail.month})</h3>
                    <span className="text-sm text-gray-400">기준일수 {detail.targetDays}일</span>
                  </div>
                  <div className="space-y-2">
                    {detail.members.map((member, idx) => (
                      <div key={member.userId} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">#{idx + 1}</span>
                            <strong>{member.nickname}</strong>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{member.role}</span>
                            {detail.leader && member.role !== "LEADER" && (
                              <button type="button" onClick={() => void onKickMember(member.userId)} className="rounded-full border border-red-400/40 px-2 py-0.5 text-xs text-red-300">강퇴</button>
                            )}
                          </div>
                          <span className="text-sm font-bold text-cyan-300">{member.attendanceRate}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.min(member.attendanceRate, 100)}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-gray-400">운동 {member.workoutDays} / {member.targetDays}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-lg font-bold">경쟁 보드</h3>
                  <p className="mt-1 text-xs text-gray-400">종합 점수 = 출석 + 챌린지 + 최근 활동 + 보너스</p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {detail.kingTitles?.map((king) => (
                      <div
                        key={king.title}
                        className={`rounded-xl border p-3 ${kingStyleByTitle[king.title]?.className ?? "border-white/20 bg-white/10 text-white"} animate-pulse`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/40 text-xs font-bold">
                            {kingStyleByTitle[king.title]?.icon ?? "K"}
                          </span>
                          <p className="text-xs">{king.title}</p>
                        </div>
                        <p className="mt-2 text-sm font-bold text-white">{king.nickname}</p>
                        <p className="text-xs opacity-90">{king.metric}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                    <div className="grid grid-cols-[56px_1fr_84px_92px] bg-white/5 px-3 py-2 text-[11px] text-gray-300">
                      <span>순위</span>
                      <span>닉네임</span>
                      <span>출석률</span>
                      <span>점수</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {detail.competitionBoard?.map((row) => (
                        <div
                          key={row.userId}
                          className={`grid grid-cols-[56px_1fr_84px_92px] border-t border-white/10 px-3 py-2 text-sm ${
                            row.rank <= 3 ? "bg-amber-500/5" : ""
                          }`}
                        >
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              row.rank === 1
                                ? "bg-amber-300 text-slate-900"
                                : row.rank === 2
                                ? "bg-slate-300 text-slate-900"
                                : row.rank === 3
                                ? "bg-orange-300 text-slate-900"
                                : "bg-white/10 text-cyan-200"
                            }`}
                          >
                            {row.rank}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{row.nickname}</p>
                            <p className="text-[11px] text-gray-400">
                              출석 {row.attendanceScore} + 도전 {row.challengeScore} + 최근 {row.recentScore}
                              {row.bonusScore > 0 ? ` + 보너스 ${row.bonusScore}` : ""}
                            </p>
                          </div>
                          <span className="text-gray-300">{row.attendanceRate}%</span>
                          <span className="font-semibold text-amber-200">{row.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {detail.leader && (
                <form onSubmit={onCreateChallenge} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                <h3 className="text-lg font-bold">모임 챌린지</h3>
                {detail.challenges.length === 0 && <p className="text-sm text-gray-400">등록된 챌린지가 없습니다.</p>}

                {detail.challenges.map((challenge) => {
                  const topMember = challenge.members[0];
                  const isEditing = editingChallengeId === challenge.id;
                  return (
                    <div key={challenge.id} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong>{challenge.title}</strong>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${challengeStatusClass[challenge.status]}`}>
                              {challengeStatusText[challenge.status]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">{challenge.startDate} ~ {challenge.endDate} · 목표 {challenge.targetWorkoutDays}일</p>
                          {challenge.description && <p className="mt-2 text-sm text-gray-300">{challenge.description}</p>}
                        </div>

                        {detail.leader && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => startEditChallenge(challenge)} className="rounded-lg border border-cyan-300/40 px-2 py-1 text-xs text-cyan-200">수정</button>
                            <button type="button" onClick={() => void onDeleteChallenge(challenge.id)} className="rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-300">삭제</button>
                          </div>
                        )}
                      </div>

                      {topMember && (
                        <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          현재 1위: <strong>{topMember.nickname}</strong> · {topMember.completionRate}% ({topMember.workoutDays}/{topMember.targetWorkoutDays})
                        </div>
                      )}

                      {isEditing && detail.leader && (
                        <form onSubmit={submitEditChallenge} className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 space-y-2">
                          <p className="text-sm font-semibold text-cyan-200">챌린지 수정</p>
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="챌린지 제목" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                            <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                            <input type="number" min={1} max={31} value={editTargetDays} onChange={(e) => setEditTargetDays(Number(e.target.value))} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">저장</button>
                            <button type="button" onClick={cancelEditChallenge} className="rounded-lg border border-white/25 px-3 py-2 text-sm text-gray-200">취소</button>
                          </div>
                        </form>
                      )}

                      <div className="grid gap-2 md:grid-cols-2">
                        {challenge.members.map((member) => (
                          <div key={`${challenge.id}-${member.userId}`} className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span>{member.nickname}</span>
                              <span className="text-cyan-300">{member.completionRate}%</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">배지: {member.badge} · {member.workoutDays}/{member.targetWorkoutDays}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
