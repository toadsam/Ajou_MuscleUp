import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { crewApi } from "../services/crewApi";
import type { CrewJoinPolicy, CrewListItem } from "../types/crew";

type CrewSeed = {
  tier: CharacterTier;
  stage: number;
  seed: string;
};

const seedFromCrew = (crew: CrewListItem): CrewSeed => {
  const memberCount = Math.max(1, crew.memberCount || 1);
  const tier: CharacterTier =
    memberCount >= 25
      ? "CHALLENGER"
      : memberCount >= 18
      ? "MASTER"
      : memberCount >= 12
      ? "DIAMOND"
      : memberCount >= 8
      ? "PLATINUM"
      : memberCount >= 5
      ? "GOLD"
      : memberCount >= 3
      ? "SILVER"
      : "BRONZE";
  const stage = Math.min(9, Math.max(1, Math.floor(memberCount / 2)));
  return { tier, stage, seed: `${crew.id}-${crew.name}-${crew.ownerNickname}` };
};

const crewEnergy = (memberCount: number) => {
  if (memberCount >= 20) return { label: "LEGEND", className: "text-amber-200 bg-amber-500/20 border-amber-300/40" };
  if (memberCount >= 10) return { label: "HYPE", className: "text-cyan-100 bg-cyan-500/20 border-cyan-300/40" };
  return { label: "START", className: "text-emerald-100 bg-emerald-500/20 border-emerald-300/40" };
};

export default function CrewHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [groups, setGroups] = useState<CrewListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<CrewJoinPolicy>("AUTO_APPROVE");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [joinResultMessage, setJoinResultMessage] = useState("");

  const joinedGroups = useMemo(() => groups.filter((g) => g.joined), [groups]);
  const featuredGroups = useMemo(() => [...groups].sort((a, b) => b.memberCount - a.memberCount).slice(0, 3), [groups]);
  const totalMembers = useMemo(() => groups.reduce((acc, item) => acc + item.memberCount, 0), [groups]);

  const loadGroups = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await crewApi.list();
      setGroups(list);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
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

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const created = await crewApi.create({
        name: name.trim(),
        description: description.trim(),
        joinPolicy,
      });
      setName("");
      setDescription("");
      setJoinPolicy("AUTO_APPROVE");
      await loadGroups();
      navigate(`/crew/${created.id}/challenges`);
    } catch (e: any) {
      setError(e?.response?.data?.message || "모임 생성에 실패했습니다.");
    }
  };

  const onJoinByCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setError("");
    setJoinResultMessage("");
    try {
      const result = await crewApi.joinByCode(inviteCodeInput.trim().toUpperCase());
      setInviteCodeInput("");
      setJoinResultMessage(result.message);
      await loadGroups();
    } catch (e: any) {
      setError(e?.response?.data?.message || "초대코드 참가에 실패했습니다.");
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 pt-24 pb-24 text-white">
      <div className="pointer-events-none absolute -left-28 top-12 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-10">
        <header className="relative rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-cyan-700/20 via-slate-900/70 to-emerald-700/20 p-5 sm:p-6">
          <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] font-black tracking-[0.14em] text-cyan-100">
            MuscleUp
          </div>
          <p className="text-xs tracking-[0.2em] text-cyan-200">CREW HUB</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">모임 찾기 · 만들기</h1>
          <p className="mt-2 text-sm text-gray-300">
            모임을 선택하면 챌린지 전용 화면으로 이동합니다. 캐릭터를 중심으로 성장과 경쟁을 확인하세요.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] text-gray-400">내 모임</p>
              <p className="text-xl font-black text-cyan-100">{joinedGroups.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] text-gray-400">전체 모임</p>
              <p className="text-xl font-black text-emerald-100">{groups.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] text-gray-400">참여 인원</p>
              <p className="text-xl font-black text-amber-100">{totalMembers}</p>
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide text-cyan-100">오늘 인기 모임</h2>
            <span className="text-xs text-gray-400">TOP 3</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {featuredGroups.map((crew) => {
              const energy = crewEnergy(crew.memberCount);
              const avatar = seedFromCrew(crew);
              return (
                <button
                  key={crew.id}
                  type="button"
                  onClick={() => navigate(`/crew/${crew.id}/challenges`)}
                  className="group rounded-2xl border border-white/15 bg-black/25 p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/50"
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${energy.className}`}>{energy.label}</span>
                    <span className="text-[11px] text-gray-400">{crew.memberCount}명</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <AvatarRenderer avatarSeed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={52} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{crew.name}</p>
                      <p className="truncate text-xs text-gray-300">리더 {crew.ownerNickname}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <form onSubmit={onCreate} className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4 space-y-3">
              <h2 className="text-lg font-bold">새 모임 만들기</h2>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="모임 이름"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="모임 소개"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
              <select
                value={joinPolicy}
                onChange={(e) => setJoinPolicy(e.target.value as CrewJoinPolicy)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
              >
                <option value="AUTO_APPROVE">가입 방식: 즉시 참여</option>
                <option value="LEADER_APPROVE">가입 방식: 방장 승인 필요</option>
              </select>
              <button type="submit" className="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">
                모임 생성하고 입장
              </button>
            </form>

            <form onSubmit={onJoinByCode} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <h2 className="text-lg font-bold">초대코드로 참가</h2>
              <input
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                maxLength={20}
                placeholder="예: A1B2C3D4"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm uppercase"
              />
              <button type="submit" className="w-full rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200">
                코드로 참여
              </button>
              {joinResultMessage && (
                <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {joinResultMessage}
                </p>
              )}
            </form>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold text-gray-300">내가 참여 중인 모임</h3>
              <div className="mt-3 space-y-2">
                {joinedGroups.length === 0 && <p className="text-xs text-gray-400">아직 참여 중인 모임이 없습니다.</p>}
                {joinedGroups.map((crew) => {
                  const avatar = seedFromCrew(crew);
                  return (
                    <button
                      key={crew.id}
                      type="button"
                      onClick={() => navigate(`/crew/${crew.id}/challenges`)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2 text-left hover:border-cyan-300/40"
                    >
                      <AvatarRenderer avatarSeed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{crew.name}</p>
                        <p className="truncate text-xs text-gray-400">{crew.ownerNickname} · {crew.memberCount}명</p>
                      </div>
                      <span className="text-xs text-cyan-200">입장</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">모임 탐색</h2>
              <span className="text-xs text-gray-400">총 {groups.length}개</span>
            </div>

            {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
            {!loading && groups.length === 0 && <p className="text-sm text-gray-400">등록된 모임이 없습니다.</p>}

            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((crew) => {
                const avatar = seedFromCrew(crew);
                return (
                  <article key={crew.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${crewEnergy(crew.memberCount).className}`}>
                        {crewEnergy(crew.memberCount).label}
                      </span>
                      <span className="text-[11px] text-gray-400">{crew.memberCount}명</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <AvatarRenderer avatarSeed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={70} />
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{crew.name}</h3>
                        <p className="text-xs text-gray-400">리더 {crew.ownerNickname}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-gray-300">{crew.description || "소개가 아직 없습니다."}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/crew/${crew.id}/challenges`)}
                        className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950"
                      >
                        챌린지 보기
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/crew/${crew.id}/lobby`)}
                        className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-2 py-2 text-xs text-cyan-100"
                      >
                        로비
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/crew/${crew.id}/highlights`)}
                        className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-2 py-2 text-xs text-amber-100"
                      >
                        하이라이트
                      </button>
                      {crew.joined ? (
                        <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">참여중</span>
                      ) : (
                        <span className="rounded-lg bg-white/10 px-2 py-1 text-xs text-gray-300">참여 전</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
