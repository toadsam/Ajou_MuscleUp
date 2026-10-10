import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { crewApi } from "../services/crewApi";
import type { CrewChallenge, CrewDetail, CrewListItem } from "../types/crew";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";

// 칸으로 나뉜 게이지: 화면에 들어오면 칸이 하나씩 켜진다.
function SegGauge({ value, cells = 10, on = "bg-plate-green" }: { value: number; cells?: number; on?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells);
  return (
    <div ref={ref} className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-[2px] border border-black transition-colors duration-200 ${inView && i < lit ? on : "bg-steel-800"}`}
          style={{ transitionDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

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
  UPCOMING: "bg-plate-blue text-white",
  ONGOING: "bg-plate-green text-white",
  ENDED: "bg-steel-700 text-steel-300",
};

const kingStyleByTitle: Record<string, { icon: string; className: string }> = {
  "성실왕": { icon: "C", className: "border-l-plate-yellow" },
  "연승왕": { icon: "S", className: "border-l-plate-green" },
  "도전왕": { icon: "D", className: "border-l-plate-red" },
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
    <section className="min-h-screen pt-28 pb-24 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-10">
        <aside className="space-y-5">
          <div className="dg-steel p-5">
            <p className="font-num text-sm font-bold text-plate-yellow">Crew</p>
            <h1 className="mt-1 text-2xl">운동 모임</h1>
            <p className="mt-2 text-sm text-steel-300">챌린지 운영, 랭킹 경쟁, 팀 출석 관리까지 한 화면에서 처리하세요.</p>
          </div>

          <form onSubmit={onCreate} className="dg-steel space-y-3 p-4">
            <h2 className="font-display text-lg">모임 만들기</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="모임 이름" className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="모임 소개 (선택)" rows={3} className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
            <button type="submit" className="dg-btn dg-btn-primary w-full min-h-[44px] text-sm">모임 생성</button>
          </form>

          <form onSubmit={onJoinByCode} className="dg-steel space-y-3 p-4">
            <h2 className="font-display text-lg">초대코드 참가</h2>
            <input value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} maxLength={20} placeholder="예: A1B2C3D4" className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow font-num text-lg font-bold uppercase" />
            <button type="submit" className="dg-btn dg-btn-steel dg-chalk-burst w-full min-h-[44px] text-sm">코드로 참여</button>
          </form>

          <div className="dg-steel space-y-2 p-4">
            <h2 className="px-1 text-sm font-bold text-steel-200">모임 목록</h2>
            {loading && (
              <p className="flex items-center gap-2 px-1 py-2 text-sm text-steel-400">
                <span className="dg-loading-plates" aria-label="불러오는 중">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                불러오는 중...
              </p>
            )}
            {!loading && groups.length === 0 && <p className="px-1 py-2 text-sm text-steel-400">아직 모임이 없습니다.</p>}
            {groups.map((group, idx) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={selectedId === group.id}
                onClick={() => setSelectedId(group.id)}
                className={`dg-rise w-full rounded-md border-2 border-l-[6px] border-black p-3 text-left transition-all duration-150 ${
                  selectedId === group.id
                    ? "border-l-plate-red bg-steel-700 shadow-sm"
                    : "border-l-steel-700 bg-steel-900 hover:-translate-y-0.5 hover:bg-steel-800 hover:shadow-sm"
                }`}
                style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="line-clamp-1 text-sm">{group.name}</strong>
                  {group.joined && <span className="dg-chip bg-plate-green text-xs text-white">참여중</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-steel-400">{group.description || "소개 없음"}</p>
                <p className="mt-2 text-xs text-steel-500">리더 {group.ownerNickname} · {group.memberCount}명</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-4">
          {error && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{error}</p>}
          {!selectedGroup && <div className="dg-steel p-6 text-steel-300">왼쪽에서 모임을 선택해주세요.</div>}

          {selectedGroup && (
            <div key={selectedGroup.id} className="dg-steel dg-rise p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <input value={detail?.name ?? selectedGroup.name} onChange={(e) => setDetail((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="dg-well px-3 py-2 font-display text-xl text-white focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                  <textarea value={detail?.description ?? selectedGroup.description ?? ""} onChange={(e) => setDetail((prev) => (prev ? { ...prev, description: e.target.value } : prev))} rows={2} className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow text-steel-200" />
                  {detail && (
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
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                  {selectedGroup.joined ? (
                    <button type="button" onClick={() => void onLeave(selectedGroup.id)} className="dg-btn min-h-[40px] bg-steel-900 px-3 text-sm text-red-300 hover:bg-plate-red hover:text-white">모임 탈퇴</button>
                  ) : (
                    <button type="button" onClick={() => void onJoin(selectedGroup.id)} className="dg-btn dg-btn-primary min-h-[40px] px-3 text-sm">모임 참여</button>
                  )}
                  {detail?.leader && (
                    <>
                      <button type="button" onClick={() => void onUpdateCrew()} className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm">모임 수정</button>
                      <button type="button" onClick={() => void onDeleteCrew()} className="dg-btn min-h-[40px] bg-steel-900 px-3 text-sm text-red-300 hover:bg-plate-red hover:text-white">모임 삭제</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {detail && (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <div className="dg-steel p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg">월간 출석 랭킹 ({detail.month})</h3>
                    <span className="text-sm text-steel-400">기준일수 {detail.targetDays}일</span>
                  </div>
                  <div className="space-y-2">
                    {detail.members.map((member, idx) => (
                      <div key={member.userId} className="dg-well dg-rise p-3" style={{ animationDelay: `${Math.min(idx, 12) * 50}ms` }}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-num w-7 text-center text-lg font-black text-steel-500">{idx + 1}</span>
                            <strong>{member.nickname}</strong>
                            <span className="dg-chip bg-steel-700 text-xs text-steel-300">{member.role}</span>
                            {detail.leader && member.role !== "LEADER" && (
                              <button type="button" onClick={() => void onKickMember(member.userId)} className="rounded border-2 border-black bg-steel-900 px-2 py-0.5 text-xs font-bold text-red-300 transition-colors hover:bg-plate-red hover:text-white">강퇴</button>
                            )}
                          </div>
                          <span className="font-num text-xl font-black text-plate-yellow"><CountNumber value={member.attendanceRate} />%</span>
                        </div>
                        <SegGauge value={member.attendanceRate} />
                        <p className="mt-2 text-xs text-steel-400">운동 {member.workoutDays} / {member.targetDays}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dg-steel p-5">
                  <h3 className="font-display text-lg">경쟁 보드</h3>
                  <p className="mt-1 text-xs text-steel-400">종합 점수 = 출석 + 챌린지 + 최근 활동 + 보너스</p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {detail.kingTitles?.map((king, idx) => (
                      <div
                        key={king.title}
                        className={`dg-well dg-plate-in border-l-[6px] p-3 ${kingStyleByTitle[king.title]?.className ?? "border-l-steel-500"}`}
                        style={{ animationDelay: `${idx * 90}ms` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-num inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-steel-700 text-xs font-black text-chalk">
                            {kingStyleByTitle[king.title]?.icon ?? "K"}
                          </span>
                          <p className="text-xs font-bold text-steel-200">{king.title}</p>
                        </div>
                        <p className="mt-2 text-sm font-bold text-white">{king.nickname}</p>
                        <p className="text-xs text-steel-300">{king.metric}</p>
                      </div>
                    ))}
                  </div>

                  <div className="dg-well mt-4 overflow-hidden">
                    <div className="grid grid-cols-[56px_1fr_84px_92px] border-b-2 border-black bg-steel-800 px-3 py-2 text-xs font-bold text-steel-300">
                      <span>순위</span>
                      <span>닉네임</span>
                      <span>출석률</span>
                      <span>점수</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {detail.competitionBoard?.map((row, idx) => (
                        <div
                          key={row.userId}
                          className={`dg-rise grid grid-cols-[56px_1fr_84px_92px] items-center border-t border-steel-800 px-3 py-2 text-sm transition-colors hover:bg-steel-800 ${
                            row.rank <= 3 ? "bg-steel-800/60" : ""
                          }`}
                          style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                        >
                          {RANK_PLATE[row.rank] ? (
                            <span
                              className={`font-num relative inline-flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-black text-sm font-black shadow-sm ${RANK_PLATE[row.rank]}`}
                            >
                              {row.rank}
                            </span>
                          ) : (
                            <span className="font-num inline-flex h-8 w-8 items-center justify-center text-xl font-black text-steel-500">{row.rank}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{row.nickname}</p>
                            <p className="text-xs text-steel-400">
                              출석 {row.attendanceScore} + 도전 {row.challengeScore} + 최근 {row.recentScore}
                              {row.bonusScore > 0 ? ` + 보너스 ${row.bonusScore}` : ""}
                            </p>
                          </div>
                          <span className="font-num font-bold text-steel-300">{row.attendanceRate}%</span>
                          <span className="font-num text-xl font-black text-plate-yellow"><CountNumber value={row.score} /></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {detail.leader && (
                <form onSubmit={onCreateChallenge} className="dg-steel border-t-[8px] border-t-plate-red p-5 space-y-3">
                  <h3 className="font-display text-lg">챌린지 만들기</h3>
                  <input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} placeholder="챌린지 제목" className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                  <textarea value={challengeDescription} onChange={(e) => setChallengeDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input type="date" value={challengeStartDate} onChange={(e) => setChallengeStartDate(e.target.value)} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                    <input type="date" value={challengeEndDate} onChange={(e) => setChallengeEndDate(e.target.value)} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                    <input type="number" min={1} max={31} value={challengeTargetDays} onChange={(e) => setChallengeTargetDays(Number(e.target.value))} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                  </div>
                  <button type="submit" className="dg-btn dg-btn-primary min-h-[44px] px-4 text-sm">챌린지 생성</button>
                </form>
              )}

              <div className="dg-steel p-5 space-y-3">
                <h3 className="font-display text-lg">모임 챌린지</h3>
                {detail.challenges.length === 0 && <p className="text-sm text-steel-400">등록된 챌린지가 없습니다.</p>}

                {detail.challenges.map((challenge) => {
                  const topMember = challenge.members[0];
                  const isEditing = editingChallengeId === challenge.id;
                  return (
                    <div key={challenge.id} className={`dg-well p-4 space-y-3 border-l-[6px] ${challenge.status === "ONGOING" ? "border-l-plate-green" : challenge.status === "UPCOMING" ? "border-l-plate-blue" : "border-l-steel-600"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong>{challenge.title}</strong>
                            <span className={`dg-chip text-xs ${challengeStatusClass[challenge.status]}`}>
                              {challengeStatusText[challenge.status]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-steel-400">{challenge.startDate} ~ {challenge.endDate} · 목표 {challenge.targetWorkoutDays}일</p>
                          {challenge.description && <p className="mt-2 text-sm text-steel-300">{challenge.description}</p>}
                        </div>

                        {detail.leader && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => startEditChallenge(challenge)} className="dg-btn dg-btn-steel min-h-[30px] px-2.5 text-xs">수정</button>
                            <button type="button" onClick={() => void onDeleteChallenge(challenge.id)} className="dg-btn min-h-[30px] bg-steel-900 px-2.5 text-xs text-red-300 hover:bg-plate-red hover:text-white">삭제</button>
                          </div>
                        )}
                      </div>

                      {topMember && (
                        <div className="flex flex-wrap items-center gap-2 rounded border-2 border-black bg-steel-800 px-3 py-2 text-xs text-steel-200">
                          <span className="font-num grid h-6 w-6 place-items-center rounded-full border-2 border-black bg-plate-yellow text-xs font-black text-black">1</span>
                          현재 1위: <strong>{topMember.nickname}</strong> · {topMember.completionRate}% ({topMember.workoutDays}/{topMember.targetWorkoutDays})
                        </div>
                      )}

                      {isEditing && detail.leader && (
                        <form onSubmit={submitEditChallenge} className="dg-pop rounded-md border-2 border-dashed border-plate-yellow bg-steel-800 p-3 space-y-2">
                          <p className="text-sm font-bold text-plate-yellow">챌린지 수정</p>
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="챌린지 제목" className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="챌린지 설명" className="w-full dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                            <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                            <input type="number" min={1} max={31} value={editTargetDays} onChange={(e) => setEditTargetDays(Number(e.target.value))} className="dg-well px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow" />
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">저장</button>
                            <button type="button" onClick={cancelEditChallenge} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">취소</button>
                          </div>
                        </form>
                      )}

                      <div className="grid gap-2 md:grid-cols-2">
                        {challenge.members.map((member) => (
                          <div key={`${challenge.id}-${member.userId}`} className="rounded border-2 border-black bg-steel-800 p-3 text-sm">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="font-semibold">{member.nickname}</span>
                              <span className="font-num text-lg font-black text-plate-yellow">{member.completionRate}%</span>
                            </div>
                            <SegGauge value={member.completionRate} cells={member.targetWorkoutDays > 0 && member.targetWorkoutDays <= 14 ? member.targetWorkoutDays : 10} on="bg-plate-yellow" />
                            <p className="mt-1.5 text-xs text-steel-400">배지: {member.badge} · {member.workoutDays}/{member.targetWorkoutDays}</p>
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
