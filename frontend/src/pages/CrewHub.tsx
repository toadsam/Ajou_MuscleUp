import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { crewApi } from "../services/crewApi";
import type { CrewJoinPolicy, CrewListItem } from "../types/crew";
import { useCountUp } from "../hooks/useCountUp";

function CountNumber({ value }: { value: number }) {
  const v = useCountUp(value, { duration: 900 });
  return <>{Math.round(v)}</>;
}

// 인기 모임 1~3위 원판 색(노랑 · 회색 · 빨강)
const MEDAL = ["bg-plate-yellow text-black", "bg-steel-300 text-black", "bg-plate-red text-white"];

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
  if (memberCount >= 20) return { label: "큰 모임", className: "bg-plate-yellow text-black" };
  if (memberCount >= 10) return { label: "활발", className: "bg-plate-red text-white" };
  return { label: "새 모임", className: "bg-plate-green text-white" };
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
    <section className="relative min-h-screen overflow-hidden pt-24 pb-24 text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-10">
        <header className="dg-steel relative p-5 sm:p-6">
          <p className="text-sm font-bold text-plate-yellow">운동 모임</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">모임 찾기 · 만들기</h1>
          <p className="mt-2 text-sm text-steel-300">
            모임을 선택하면 챌린지 전용 화면으로 이동합니다. 캐릭터를 중심으로 성장과 경쟁을 확인하세요.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
            <div className="dg-well p-3">
              <p className="text-xs text-steel-400">내 모임</p>
              <p className="font-num text-3xl font-black text-plate-yellow"><CountNumber value={joinedGroups.length} /></p>
            </div>
            <div className="dg-well p-3">
              <p className="text-xs text-steel-400">전체 모임</p>
              <p className="font-num text-3xl font-black text-white"><CountNumber value={groups.length} /></p>
            </div>
            <div className="dg-well p-3">
              <p className="text-xs text-steel-400">참여 인원</p>
              <p className="font-num text-3xl font-black text-white"><CountNumber value={totalMembers} /></p>
            </div>
          </div>
        </header>

        {error && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{error}</p>}

        <div className="dg-steel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">인기 모임</h2>
            <span className="text-sm font-black text-plate-yellow">인원 많은 순 3곳</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {featuredGroups.map((crew, idx) => {
              const energy = crewEnergy(crew.memberCount);
              const avatar = seedFromCrew(crew);
              return (
                <button
                  key={crew.id}
                  type="button"
                  onClick={() => navigate(`/crew/${crew.id}/challenges`)}
                  className="dg-lift dg-rise group rounded-lg border-[3px] border-black bg-steel-900 p-3 text-left shadow-md"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`font-num grid h-7 w-7 place-items-center rounded-full border-2 border-black text-sm font-black ${MEDAL[idx]}`}>{idx + 1}</span>
                      <span className={`dg-chip text-xs ${energy.className}`}>{energy.label}</span>
                    </span>
                    <span className="font-num text-sm font-bold text-steel-300">{crew.memberCount}명</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <AvatarRenderer avatarSeed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={52} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{crew.name}</p>
                      <p className="truncate text-xs text-steel-300">리더 {crew.ownerNickname}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <form onSubmit={onCreate} className="dg-steel border-t-[8px] border-t-plate-red p-4 space-y-3">
              <h2 className="font-display text-lg">새 모임 만들기</h2>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="모임 이름"
                className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="모임 소개"
                className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
              />
              <select
                value={joinPolicy}
                onChange={(e) => setJoinPolicy(e.target.value as CrewJoinPolicy)}
                className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
              >
                <option value="AUTO_APPROVE">가입 방식: 즉시 참여</option>
                <option value="LEADER_APPROVE">가입 방식: 방장 승인 필요</option>
              </select>
              <button type="submit" className="dg-btn dg-btn-primary w-full min-h-[44px] text-sm">
                모임 생성하고 입장
              </button>
            </form>

            <form onSubmit={onJoinByCode} className="dg-steel p-4 space-y-3">
              <h2 className="font-display text-lg">초대코드로 참가</h2>
              <input
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                maxLength={20}
                placeholder="예: A1B2C3D4"
                className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow font-num text-lg font-bold uppercase"
              />
              <button type="submit" className="dg-btn dg-btn-steel dg-chalk-burst w-full min-h-[44px] text-sm">
                코드로 참여
              </button>
              {joinResultMessage && (
                <p className="dg-pop dg-well border-l-[6px] border-l-plate-green px-3 py-2 text-xs font-semibold text-green-200">
                  {joinResultMessage}
                </p>
              )}
            </form>

            <div className="dg-steel p-4">
              <h3 className="text-sm font-bold text-steel-200">내가 참여 중인 모임</h3>
              <div className="mt-3 space-y-2">
                {joinedGroups.length === 0 && <p className="text-xs text-steel-400">아직 참여 중인 모임이 없습니다.</p>}
                {joinedGroups.map((crew) => {
                  const avatar = seedFromCrew(crew);
                  return (
                    <button
                      key={crew.id}
                      type="button"
                      onClick={() => navigate(`/crew/${crew.id}/challenges`)}
                      className="group flex w-full items-center gap-3 rounded-md border-2 border-black border-l-[6px] border-l-plate-green bg-steel-900 p-2 text-left transition-all duration-150 hover:-translate-y-0.5 hover:bg-steel-800 hover:shadow-sm"
                    >
                      <AvatarRenderer avatarSeed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{crew.name}</p>
                        <p className="truncate text-xs text-steel-400">{crew.ownerNickname} · {crew.memberCount}명</p>
                      </div>
                      <span className="text-xs font-bold text-plate-yellow transition-transform group-hover:translate-x-0.5">입장</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="dg-steel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg">모임 탐색</h2>
              <span className="text-xs text-steel-400">총 {groups.length}개</span>
            </div>

            {loading && (
              <p className="flex items-center gap-3 text-sm text-steel-400">
                <span className="dg-loading-plates" aria-label="불러오는 중">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                불러오는 중...
              </p>
            )}
            {!loading && groups.length === 0 && <p className="text-sm text-steel-400">등록된 모임이 없습니다.</p>}

            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((crew, idx) => {
                const avatar = seedFromCrew(crew);
                return (
                  <article
                    key={crew.id}
                    className={`dg-well dg-rise p-4 transition-transform duration-150 hover:-translate-y-0.5 ${crew.joined ? "border-l-[6px] border-l-plate-green" : ""}`}
                    style={{ animationDelay: `${Math.min(idx, 12) * 50}ms` }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`dg-chip text-xs ${crewEnergy(crew.memberCount).className}`}>
                        {crewEnergy(crew.memberCount).label}
                      </span>
                      <span className="font-num text-sm font-bold text-steel-300">{crew.memberCount}명</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <AvatarRenderer avatarSeed={avatar.seed} tier={avatar.tier} stage={avatar.stage} size={70} />
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{crew.name}</h3>
                        <p className="text-xs text-steel-400">리더 {crew.ownerNickname}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-steel-300">{crew.description || "소개가 아직 없습니다."}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/crew/${crew.id}/challenges`)}
                        className="dg-btn dg-btn-primary min-h-[34px] px-3 text-xs"
                      >
                        챌린지 보기
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/crew/${crew.id}/lobby`)}
                        className="dg-btn dg-btn-steel min-h-[34px] px-2.5 text-xs"
                      >
                        로비
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/crew/${crew.id}/highlights`)}
                        className="dg-btn dg-btn-steel min-h-[34px] px-2.5 text-xs"
                      >
                        하이라이트
                      </button>
                      {crew.joined ? (
                        <span className="dg-chip bg-plate-green text-xs text-white">참여중</span>
                      ) : (
                        <span className="dg-chip bg-steel-700 text-xs text-steel-300">참여 전</span>
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
