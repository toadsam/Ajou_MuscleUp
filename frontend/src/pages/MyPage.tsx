import { useEffect, useMemo, useState } from "react";
import CharacterCard from "../components/CharacterCard";
import { Link } from "react-router-dom";
import type { GrowthParams } from "../components/avatar/types";
import {
  CUSTOM_PART_LABEL,
  CUSTOM_UNLOCK_REQUIREMENTS,
  getUnlockedParts,
  loadAvatarCustomization,
  saveAvatarCustomization,
  type AvatarCustomization,
  type CustomPart,
} from "../utils/avatarCustomization";
import { resolveEvolutionBranch, resolveSkillUnlocks } from "../utils/evolutionProgress";
import { saveAppearanceBySeed } from "../utils/avatarAppearanceState";

type BragPost = {
  id: number;
  title: string;
  movement?: string | null;
  weight?: string | null;
  likeCount?: number;
};

type BragComment = {
  id: number;
  content: string;
  authorNickname?: string | null;
  createdAt?: string | null;
};

type AiChatLogItem = {
  question: string;
  answer: string;
  createdAt?: string | null;
};

type MyPageResponse = {
  email: string;
  nickname: string;
  recentComments: BragComment[];
  recentLikes: BragPost[];
  recentAiChats: AiChatLogItem[];
};

type UserBodyStats = {
  heightCm: number | null;
  gender: "MALE" | "FEMALE" | null;
  weightKg: number | null;
  skeletalMuscleKg: number | null;
  bodyFatPercent: number | null;
  mbti: string | null;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
  updatedAt?: string | null;
};

type CharacterProfile = {
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";
  evolutionStage: number;
  title: string;
  isPublic: boolean;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
  avatarSeed: string;
  stylePreset: string;
  growthParams?: GrowthParams | null;
  lastEvaluatedAt?: string | null;
};

type CharacterEvaluation = {
  threeLiftTotal: number;
  strengthRatio: number;
  bmi?: number;
  skeletalMuscleIndex?: number;
  heightWeightScore?: number;
  heightMuscleScore?: number;
  totalScore: number;
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";
  evolutionStage: number;
  title: string;
};

type CharacterChange = {
  leveledUp: boolean;
  evolved: boolean;
  tierChanged: boolean;
};

type RankSummary = {
  totalPublic: number;
  myRank: number | null;
  myTopPercent: number | null;
};

type StatsCharacterResponse = {
  stats: UserBodyStats;
  character: CharacterProfile;
  evaluation: CharacterEvaluation;
  change: CharacterChange;
};

type AttendanceSummary = {
  monthWorkoutCount: number;
  currentStreak: number;
  bestStreakInMonth?: number | null;
};

type Toast = { type: "success" | "error"; message: string };

type EffectBanner = { message: string; kind: "level" | "evolution" | "tier" };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
    ...init,
  });
  if (res.status === 401) {
    alert("로그인이 필요합니다.");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

const formatDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const emptyForm = {
  heightCm: "",
  gender: "MALE",
  weightKg: "",
  skeletalMuscleKg: "",
  bodyFatPercent: "",
  mbti: "",
  benchKg: "",
  squatKg: "",
  deadliftKg: "",
};

const tierDescriptions: Record<string, string> = {
  BRONZE: "입문 단계",
  SILVER: "기초 루틴 완성",
  GOLD: "꾸준함의 증거",
  PLATINUM: "강한 실력자",
  DIAMOND: "상위권 파워",
  MASTER: "최상위 강자",
  GRANDMASTER: "엘리트 중 엘리트",
  CHALLENGER: "정점의 전설",
};

const stageDescriptions = [
  "초기 성장",
  "근육 각성",
  "코어 강화",
  "근지구력 상승",
  "상체 강화",
  "하체 강화",
  "전신 밸런스",
  "파워 급상승",
  "마스터 폼",
  "완전체",
];

type StatsForm = typeof emptyForm;
const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const skillToggleStorageKey = (email?: string | null) => `avatar-skill-toggle-v1:${email?.trim().toLowerCase() || "guest"}`;

const loadSkillToggles = (email?: string | null): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(skillToggleStorageKey(email));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "boolean"));
  } catch {
    return {};
  }
};

export default function MyPage() {
  const [data, setData] = useState<MyPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<UserBodyStats | null>(null);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [evaluation, setEvaluation] = useState<CharacterEvaluation | null>(null);
  const [change, setChange] = useState<CharacterChange | null>(null);
  const [rank, setRank] = useState<RankSummary | null>(null);
  const [form, setForm] = useState<StatsForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [banner, setBanner] = useState<EffectBanner | null>(null);
  const [publicUpdating, setPublicUpdating] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [rerollBurstNonce, setRerollBurstNonce] = useState(0);
  const [rerollCinematic, setRerollCinematic] = useState(false);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [customization, setCustomization] = useState<AvatarCustomization>({});
  const [skillEnabledMap, setSkillEnabledMap] = useState<Record<string, boolean>>({});
  const [isResting, setIsResting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpenSections, setMobileOpenSections] = useState({
    stats: true,
    gear: false,
    logs: false,
    feedback: false,
  });

  const toggleMobileSection = (key: keyof typeof mobileOpenSections) => {
    setMobileOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const monthKey = formatMonthKey(new Date());
        const [pageRes, statsRes, characterRes] = await Promise.all([
          api<MyPageResponse>("/api/mypage"),
          api<UserBodyStats | null>("/api/mypage/stats"),
          api<CharacterProfile>("/api/character/me"),
        ]);
        setData(pageRes);
        setStats(statsRes);
        setCharacter(characterRes);
        setCustomization(loadAvatarCustomization(pageRes.email));
        setSkillEnabledMap(loadSkillToggles(pageRes.email));
        setIsResting(Boolean(characterRes.isResting));
        try {
          const attendanceSummary = await api<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`);
          setAttendanceCount(attendanceSummary.monthWorkoutCount ?? 0);
        } catch (e) {
          setAttendanceCount(0);
        }
        try {
          const rankRes = await api<RankSummary>("/api/rankings/characters?type=LEVEL&limit=1");
          setRank(rankRes);
        } catch (e) {
          setRank(null);
        }

        if (statsRes) {
          setForm({
            heightCm: statsRes.heightCm?.toString() ?? "",
            gender: statsRes.gender ?? "MALE",
            weightKg: statsRes.weightKg?.toString() ?? "",
            skeletalMuscleKg: statsRes.skeletalMuscleKg?.toString() ?? "",
            bodyFatPercent: statsRes.bodyFatPercent?.toString() ?? "",
            mbti: statsRes.mbti ?? "",
            benchKg: statsRes.benchKg?.toString() ?? "",
            squatKg: statsRes.squatKg?.toString() ?? "",
            deadliftKg: statsRes.deadliftKg?.toString() ?? "",
          });
          try {
            const evalRes = await api<StatsCharacterResponse>("/api/character/evaluate", { method: "POST" });
            setCharacter(evalRes.character);
            setEvaluation(evalRes.evaluation);
            setChange(null);
          } catch (e) {
            setEvaluation(null);
          }
        } else {
          setForm(emptyForm);
        }
      } catch (e: any) {
        setError(e?.message || "마이페이지 정보를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!change) return;
    if (change.evolved) {
      setBanner({ message: "EVOLUTION!", kind: "evolution" });
    } else if (change.leveledUp) {
      setBanner({ message: "LEVEL UP!", kind: "level" });
    } else if (change.tierChanged) {
      setBanner({ message: "TIER UP!", kind: "tier" });
    } else {
      return;
    }
    const timer = window.setTimeout(() => setBanner(null), 2600);
    return () => window.clearTimeout(timer);
  }, [change]);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2000);
  };

  const triggerTransformFx = (duration = 2400) => {
    setRerollCinematic(true);
    window.setTimeout(() => setRerollCinematic(false), duration);
  };

  const parseNumber = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const saveStats = async () => {
    const payload = {
      heightCm: parseNumber(form.heightCm),
      gender: form.gender,
      weightKg: parseNumber(form.weightKg),
      skeletalMuscleKg: parseNumber(form.skeletalMuscleKg),
      bodyFatPercent: parseNumber(form.bodyFatPercent),
      mbti: form.mbti.trim() ? form.mbti.trim().toUpperCase() : null,
      benchKg: parseNumber(form.benchKg),
      squatKg: parseNumber(form.squatKg),
      deadliftKg: parseNumber(form.deadliftKg),
    };

    if (payload.weightKg === null || payload.weightKg < 20 || payload.weightKg > 300) {
      showToast({ type: "error", message: "몸무게는 20~300kg 사이로 입력해 주세요." });
      return;
    }
    if (payload.mbti && !/^[EI][NS][TF][JP]$/.test(payload.mbti)) {
      showToast({ type: "error", message: "MBTI는 예: INTP 형태로 입력해 주세요." });
      return;
    }

    try {
      setSaving(true);
      const res = await api<StatsCharacterResponse>("/api/mypage/stats", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStats(res.stats);
      setCharacter(res.character);
      setIsResting(Boolean(res.character.isResting));
      setEvaluation(res.evaluation);
      setChange(res.change);
      if (res.change?.leveledUp || res.change?.evolved || res.change?.tierChanged) {
        triggerTransformFx(2200);
      }
      try {
        const rankRes = await api<RankSummary>("/api/rankings/characters?type=LEVEL&limit=1");
        setRank(rankRes);
      } catch (e) {
        setRank(null);
      }
      showToast({ type: "success", message: "스탯이 저장되었습니다." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async () => {
    if (!character) return;
    try {
      setPublicUpdating(true);
      const res = await api<CharacterProfile>("/api/character/me/public", {
        method: "PUT",
        body: JSON.stringify({ isPublic: !character.isPublic }),
      });
      setCharacter(res);
      setIsResting(Boolean(res.isResting));
      showToast({ type: "success", message: res.isPublic ? "공개로 전환했어요." : "비공개로 전환했어요." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "설정 변경에 실패했습니다." });
    } finally {
      setPublicUpdating(false);
    }
  };

  const rerollAvatar = async () => {
    try {
      setRerolling(true);
      const res = await api<CharacterProfile>("/api/character/reroll", { method: "POST" });
      setCharacter(res);
      setIsResting(Boolean(res.isResting));
      setChange({ leveledUp: false, evolved: false, tierChanged: true });
      triggerTransformFx(3200);
      setBanner({ message: "REFORGED!", kind: "tier" });
      setRerollBurstNonce((prev) => prev + 1);
      showToast({ type: "success", message: "강화 연출과 함께 외형이 재생성됐어요." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "리롤에 실패했습니다." });
    } finally {
      setRerolling(false);
    }
  };

  const unlockedParts = useMemo(() => getUnlockedParts(attendanceCount), [attendanceCount]);

  const updateCustomization = (next: AvatarCustomization) => {
    setCustomization(next);
    saveAvatarCustomization(data?.email, next);
  };

  const onCustomImageChange = (part: CustomPart, file?: File | null) => {
    if (!file) return;
    if (!unlockedParts[part]) {
      showToast({ type: "error", message: `${CUSTOM_UNLOCK_REQUIREMENTS[part]}일 달성 후 열립니다.` });
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast({ type: "error", message: "이미지 파일만 업로드할 수 있어요." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast({ type: "error", message: "2MB 이하 이미지를 선택해 주세요." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value) return;
      updateCustomization({ ...customization, [part]: value });
      showToast({ type: "success", message: `${CUSTOM_PART_LABEL[part]} 커스텀을 적용했어요.` });
    };
    reader.onerror = () => showToast({ type: "error", message: "이미지 읽기에 실패했어요." });
    reader.readAsDataURL(file);
  };

  const clearCustomImage = (part: CustomPart) => {
    const next = { ...customization, [part]: null };
    updateCustomization(next);
    showToast({ type: "success", message: `${CUSTOM_PART_LABEL[part]} 커스텀을 해제했어요.` });
  };

  const evolutionBranch = useMemo(() => {
    if (!character) return null;
    return resolveEvolutionBranch({
      strengthRatio: evaluation?.strengthRatio,
      threeLiftTotal: evaluation?.threeLiftTotal,
      muscularity: character.growthParams?.muscularityNormalized,
      bodyFat: character.growthParams?.fatNormalized,
    });
  }, [character, evaluation]);

  const skillUnlocks = useMemo(() => {
    if (!character || !evolutionBranch) return [];
    return resolveSkillUnlocks({
      level: character.level,
      stage: character.evolutionStage,
      tier: character.tier,
      attendanceCount,
      branch: evolutionBranch,
    });
  }, [character, evolutionBranch, attendanceCount]);

  const activeSkillCount = useMemo(
    () => skillUnlocks.filter((skill) => skill.unlocked && (skillEnabledMap[skill.id] ?? true)).length,
    [skillUnlocks, skillEnabledMap]
  );
  const activeSkillIds = useMemo(
    () => skillUnlocks.filter((skill) => skill.unlocked && (skillEnabledMap[skill.id] ?? true)).map((skill) => skill.id),
    [skillUnlocks, skillEnabledMap]
  );

  const toggleSkillEnabled = (skillId: string) => {
    setSkillEnabledMap((prev) => ({ ...prev, [skillId]: !(prev[skillId] ?? true) }));
  };

  useEffect(() => {
    if (!data?.email) return;
    localStorage.setItem(skillToggleStorageKey(data.email), JSON.stringify(skillEnabledMap));
  }, [data?.email, skillEnabledMap]);

  useEffect(() => {
    if (!character?.avatarSeed) return;
    saveAppearanceBySeed(character.avatarSeed, {
      branch: evolutionBranch ?? null,
      activeSkillIds,
      customization,
      gender: character.gender ?? stats?.gender ?? null,
      isResting,
    });
  }, [character?.avatarSeed, character?.gender, evolutionBranch, activeSkillIds, customization, stats?.gender, isResting]);

  const toggleResting = async () => {
    if (!character) return;
    const nextResting = !isResting;
    try {
      const res = await api<CharacterProfile>("/api/character/me/resting", {
        method: "PUT",
        body: JSON.stringify({ isResting: nextResting }),
      });
      setCharacter(res);
      setIsResting(Boolean(res.isResting));
      showToast({ type: "success", message: nextResting ? "휴식 모드로 전환했어요." : "활동 모드로 전환했어요." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "휴식 모드 변경에 실패했습니다." });
    }
  };

  const statInputs = useMemo(
    () => [
      { key: "heightCm", label: "키(cm)", placeholder: "170", step: "1" },
      { key: "gender", label: "성별", placeholder: "", step: "" },
      { key: "weightKg", label: "몸무게(kg)", placeholder: "72.5", step: "0.1" },
      { key: "skeletalMuscleKg", label: "골격근량(kg)", placeholder: "33", step: "0.1" },
      { key: "bodyFatPercent", label: "체지방률(%)", placeholder: "18.5", step: "0.1" },
      { key: "mbti", label: "MBTI", placeholder: "INTP", step: "1" },
      { key: "benchKg", label: "벤치(kg)", placeholder: "90", step: "0.5" },
      { key: "squatKg", label: "스쿼트(kg)", placeholder: "120", step: "0.5" },
      { key: "deadliftKg", label: "데드(kg)", placeholder: "140", step: "0.5" },
    ],
    []
  );

  return (
    <section className="pt-32 pb-20 px-5 md:px-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-pink-300">내 기록</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">마이페이지</h1>
          {data && (
            <p className="text-gray-300">
              {data.nickname} ({data.email})
            </p>
          )}
        </header>

        {loading &&
          (isMobile ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
                <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
              </div>
              <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
            </div>
          ) : (
            <div className="text-gray-300">불러오는 중...</div>
          ))}
        {error && <div className="text-red-400">{error}</div>}

        {isMobile && !loading && !error && (
          <div className="space-y-4 md:hidden">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">캐릭터 상태</p>
                <p className="mt-2 text-base font-bold text-white">
                  {character ? `${character.tier} · Stage ${character.evolutionStage}` : "준비 중"}
                </p>
                <p className="mt-1 text-xs text-gray-400">{isResting ? "회복/휴식 중" : "활동 가능"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">현재 랭크</p>
                <p className="mt-2 text-base font-bold text-white">#{rank?.myRank ?? "-"}</p>
                <p className="mt-1 text-xs text-gray-400">상위 {rank?.myTopPercent ?? "-"}%</p>
              </div>
            </div>

            {character && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="px-2 pt-1 text-[11px] uppercase tracking-[0.18em] text-gray-400">내 캐릭터 미리보기</p>
                <div className="mt-2 overflow-hidden rounded-xl">
                  <CharacterCard
                    character={character}
                    evaluation={evaluation}
                    gender={character.gender ?? stats?.gender}
                    mbti={stats?.mbti}
                    isResting={isResting}
                    change={change}
                    customization={customization}
                    rerollBurstNonce={rerollBurstNonce}
                    evolutionBranch={evolutionBranch}
                    unlockedSkills={skillUnlocks}
                    skillEnabledMap={skillEnabledMap}
                    onToggleSkill={toggleSkillEnabled}
                  />
                </div>
              </div>
            )}

            <Link to="/attendance" className="block rounded-2xl border border-pink-400/40 bg-pink-500/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-pink-100">오늘 해야 할 1개</p>
              <p className="mt-1 text-base font-bold text-white">출석 체크하러 가기</p>
            </Link>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => toggleMobileSection("stats")}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-semibold">통계</span>
                <span className="text-sm text-gray-300">{mobileOpenSections.stats ? "접기" : "펼치기"}</span>
              </button>
              {mobileOpenSections.stats && (
                <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
                  {statInputs.map((field) => (
                    <label key={`m-${field.key}`} className="text-xs text-gray-300">
                      <span>{field.label}</span>
                      {field.key === "gender" ? (
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, gender: "MALE" }))}
                            className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${form.gender === "MALE" ? "border-pink-400 bg-pink-500/20" : "border-white/20"}`}
                          >
                            남
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, gender: "FEMALE" }))}
                            className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${form.gender === "FEMALE" ? "border-pink-400 bg-pink-500/20" : "border-white/20"}`}
                          >
                            여
                          </button>
                        </div>
                      ) : (
                        <input
                          type={field.key === "mbti" ? "text" : "number"}
                          step={field.step || undefined}
                          maxLength={field.key === "mbti" ? 4 : undefined}
                          placeholder={field.placeholder}
                          value={form[field.key as keyof StatsForm] as string}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              [field.key]:
                                field.key === "mbti" ? e.target.value.toUpperCase() : e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                        />
                      )}
                    </label>
                  ))}
                  <button
                    onClick={saveStats}
                    disabled={saving}
                    className="col-span-2 mt-1 rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => toggleMobileSection("gear")}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-semibold">장비</span>
                <span className="text-sm text-gray-300">{mobileOpenSections.gear ? "접기" : "펼치기"}</span>
              </button>
              {mobileOpenSections.gear && (
                <div className="space-y-3 border-t border-white/10 p-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => void toggleResting()} className="rounded-full border border-white/20 px-3 py-1.5 text-xs">
                      {isResting ? "휴식중" : "휴식 모드"}
                    </button>
                    <button onClick={rerollAvatar} disabled={rerolling} className="rounded-full border border-amber-300/60 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-60">
                      {rerolling ? "리롤 중..." : "다시 만들기"}
                    </button>
                    <button onClick={togglePublic} disabled={publicUpdating} className="rounded-full border border-emerald-400/70 px-3 py-1.5 text-xs">
                      {character?.isPublic ? "공개 중" : "비공개"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["face", "body", "emblem"] as CustomPart[]).map((part) => {
                      const unlocked = unlockedParts[part];
                      const image = customization[part];
                      return (
                        <div key={`m-part-${part}`} className="rounded-xl border border-white/10 bg-black/20 p-2">
                          <p className="text-[11px] text-white">{CUSTOM_PART_LABEL[part]}</p>
                          <div className="mt-1 h-16 overflow-hidden rounded-md border border-white/10 bg-black/30">
                            {image ? (
                              <img src={image} alt={`${part} custom`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-gray-400">{unlocked ? "이미지 없음" : "잠김"}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => toggleMobileSection("logs")}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-semibold">로그</span>
                <span className="text-sm text-gray-300">{mobileOpenSections.logs ? "접기" : "펼치기"}</span>
              </button>
              {mobileOpenSections.logs && (
                <div className="space-y-2 border-t border-white/10 p-3">
                  {data?.recentAiChats?.slice(0, 8).map((item, idx) => (
                    <div key={`m-ai-${idx}`} className="rounded-xl border border-white/10 bg-black/25 p-2">
                      <p className="text-[11px] text-gray-400">{formatDate(item.createdAt)}</p>
                      <p className="text-xs font-semibold text-white">Q. {item.question}</p>
                      <p className="text-xs text-gray-300 line-clamp-3">A. {item.answer}</p>
                    </div>
                  ))}
                  {(!data?.recentAiChats || data.recentAiChats.length === 0) && <p className="text-xs text-gray-400">AI 기록이 없습니다.</p>}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => toggleMobileSection("feedback")}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-semibold">공개 피드백</span>
                <span className="text-sm text-gray-300">{mobileOpenSections.feedback ? "접기" : "펼치기"}</span>
              </button>
              {mobileOpenSections.feedback && (
                <div className="space-y-2 border-t border-white/10 p-3">
                  <div className="space-y-2">
                    {(data?.recentComments ?? []).slice(0, 6).map((c) => (
                      <div key={`m-c-${c.id}`} className="rounded-xl border border-white/10 bg-black/25 p-2">
                        <p className="text-[11px] text-gray-400">{c.authorNickname || "익명"} · {formatDate(c.createdAt)}</p>
                        <p className="text-xs text-gray-200 line-clamp-2">{c.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(data?.recentLikes ?? []).slice(0, 6).map((p) => (
                      <a key={`m-l-${p.id}`} href={`/brag/${p.id}`} className="block rounded-xl border border-white/10 bg-black/25 p-2">
                        <p className="text-xs font-semibold text-pink-200 line-clamp-1">{p.title}</p>
                        <p className="text-[11px] text-gray-400">Likes {p.likeCount ?? 0}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hidden gap-6 md:grid lg:grid-cols-[1.15fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">내 스탯 입력</h2>
              {stats?.updatedAt && (
                <span className="text-xs text-gray-400">최근 저장 {formatDate(stats.updatedAt)}</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {statInputs.map((field) => (
                <label key={field.key} className="text-sm text-gray-300 space-y-2">
                  <span>{field.label}</span>
                  {field.key === "gender" ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, gender: "MALE" }))}
                        className={`px-4 py-2 rounded-full text-xs border transition ${
                          form.gender === "MALE" ? "border-pink-400 bg-pink-500/20" : "border-white/20"
                        }`}
                      >
                        남
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, gender: "FEMALE" }))}
                        className={`px-4 py-2 rounded-full text-xs border transition ${
                          form.gender === "FEMALE" ? "border-pink-400 bg-pink-500/20" : "border-white/20"
                        }`}
                      >
                        여
                      </button>
                    </div>
                  ) : field.key === "mbti" ? (
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={form[field.key as keyof StatsForm] as string}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value.toUpperCase() }))}
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                      maxLength={4}
                    />
                  ) : (
                    <input
                      type="number"
                      step={field.step}
                      placeholder={field.placeholder}
                      value={form[field.key as keyof StatsForm] as string}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">몸무게는 필수 입력입니다.</span>
              <button
                onClick={saveStats}
                disabled={saving}
                className="px-5 py-2 rounded-full bg-pink-500 text-white text-sm font-semibold hover:bg-pink-400 transition disabled:opacity-60"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {character ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">내 캐릭터</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void toggleResting()}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                      isResting
                        ? "border-sky-300/80 bg-sky-400/15 text-sky-100"
                        : "border-white/20 text-gray-200 hover:border-sky-300/50"
                    }`}
                  >
                    {isResting ? "휴식중" : "휴식 모드"}
                  </button>
                  <button
                    onClick={rerollAvatar}
                    disabled={rerolling}
                    className="px-4 py-2 rounded-full text-xs font-semibold border border-amber-300/60 text-amber-100 hover:bg-amber-400/15 transition disabled:opacity-60"
                  >
                    {rerolling ? "리롤 중..." : "다시 만들기"}
                  </button>
                  <button
                    onClick={togglePublic}
                    disabled={publicUpdating}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                      character.isPublic
                        ? "border-emerald-400 text-emerald-200"
                        : "border-white/30 text-gray-200"
                    }`}
                  >
                    {character.isPublic ? "공개 중" : "비공개"}
                  </button>
                </div>
              </div>
              <CharacterCard
                character={character}
                evaluation={evaluation}
                gender={character.gender ?? stats?.gender}
                mbti={stats?.mbti}
                isResting={isResting}
                change={change}
                customization={customization}
                rerollBurstNonce={rerollBurstNonce}
                evolutionBranch={evolutionBranch}
                unlockedSkills={skillUnlocks}
                skillEnabledMap={skillEnabledMap}
                onToggleSkill={toggleSkillEnabled}
              />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Tier Info</div>
                  <div className="text-white font-semibold">
                    {character.tier} · {tierDescriptions[character.tier] ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Evolution Stage</div>
                  <div className="text-white font-semibold">
                    Stage {character.evolutionStage} · {stageDescriptions[character.evolutionStage] ?? "성장 중"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Evolution Branch</div>
                  <div className="text-white font-semibold">{evolutionBranch ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Skill Unlock</div>
                  <div className="text-white font-semibold">{activeSkillCount} / {skillUnlocks.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Condition</div>
                  <div className={`font-semibold ${isResting ? "text-sky-200" : "text-white"}`}>{isResting ? "회복/휴식 중" : "활동 가능"}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 flex flex-wrap gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">My Rank</div>
                  <div className="text-white text-lg font-semibold">{rank?.myRank ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Top Percent</div>
                  <div className="text-white text-lg font-semibold">{rank?.myTopPercent !== undefined && rank?.myTopPercent !== null ? `${rank.myTopPercent}%` : "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Public Total</div>
                  <div className="text-white text-lg font-semibold">{rank?.totalPublic ?? 0}</div>
                </div>
                {!character.isPublic && (
                  <div className="text-xs text-gray-400">공개 설정 시 랭킹이 계산됩니다.</div>
                )}
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200/90">Attendance Unlock</p>
                  <h3 className="text-lg font-bold text-amber-50">사진 커스텀 해금</h3>
                  <p className="text-xs text-amber-100/80">이번 달 운동 출석 {attendanceCount}일 기준으로 파트가 열립니다.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(["face", "body", "emblem"] as CustomPart[]).map((part) => {
                    const unlocked = unlockedParts[part];
                    const image = customization[part];
                    return (
                      <div key={part} className={`rounded-xl border p-3 ${unlocked ? "border-emerald-300/50 bg-emerald-500/10" : "border-white/15 bg-black/20"}`}>
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-white">{CUSTOM_PART_LABEL[part]}</strong>
                          <span className={`text-[11px] ${unlocked ? "text-emerald-200" : "text-gray-400"}`}>
                            {unlocked ? "해금" : `${CUSTOM_UNLOCK_REQUIREMENTS[part]}일 필요`}
                          </span>
                        </div>
                        <div className="mt-2 h-20 rounded-lg border border-white/10 bg-black/30 overflow-hidden">
                          {image ? (
                            <img src={image} alt={`${part} custom`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                              {unlocked ? "이미지 없음" : "잠김"}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className={`flex-1 text-center px-2 py-1.5 rounded-md text-xs font-semibold border ${unlocked ? "border-white/25 text-white hover:bg-white/10 cursor-pointer" : "border-white/10 text-gray-500 cursor-not-allowed"}`}>
                            업로드
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={!unlocked}
                              onChange={(e) => {
                                onCustomImageChange(part, e.target.files?.[0]);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="px-2 py-1.5 rounded-md text-xs border border-white/20 text-gray-200 disabled:opacity-40"
                            disabled={!image}
                            onClick={() => clearCustomImage(part)}
                          >
                            해제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-gray-300">
              캐릭터 정보를 불러오는 중입니다.
            </div>
          )}
        </div>

        {data && (
          <div className="hidden gap-6 md:grid md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">최근 댓글</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentComments.length === 0 && <p className="text-gray-400 text-sm">댓글 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentComments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{c.authorNickname || "익명"}</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-gray-200 mt-1 whitespace-pre-line">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">좋아요한 글</h2>
                <span className="text-sm text-gray-400">최신순</span>
              </div>
              {data.recentLikes.length === 0 && <p className="text-gray-400 text-sm">좋아요 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentLikes.map((p) => (
                  <a
                    key={p.id}
                    href={`/brag/${p.id}`}
                    className="block rounded-xl bg-gray-900/60 border border-gray-700 p-3 hover:border-pink-400/50 transition"
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-pink-200">{p.title}</p>
                      <span className="text-sm text-gray-400">Likes {p.likeCount ?? 0}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {p.movement || "-"} {p.weight ? `· ${p.weight}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">AI 사용 기록</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentAiChats.length === 0 && <p className="text-gray-400 text-sm">AI 기록이 없습니다.</p>}
              <div className="grid md:grid-cols-2 gap-3">
                {data.recentAiChats.map((item, idx) => (
                  <div key={idx} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3 space-y-1">
                    <div className="text-xs text-gray-500">{formatDate(item.createdAt)}</div>
                    <p className="text-sm font-semibold text-white">Q. {item.question}</p>
                    <p className="text-sm text-gray-200 whitespace-pre-line">A. {item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed top-24 right-6 z-50 rounded-full px-4 py-2 text-sm shadow-lg ${
            toast.type === "success" ? "bg-emerald-400 text-black" : "bg-rose-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {banner && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold tracking-[0.3em] shadow-xl ${
            banner.kind === "evolution"
              ? "bg-cyan-400 text-black"
              : banner.kind === "tier"
              ? "bg-amber-300 text-black"
              : "bg-pink-500 text-white"
          }`}
        >
          {banner.message}
        </div>
      )}

      {rerollCinematic && (
        <div className="reroll-cinematic-overlay" aria-hidden="true">
          <div className="reroll-cinematic-flash" />
          <div className="reroll-cinematic-ring ring-1" />
          <div className="reroll-cinematic-ring ring-2" />
          <div className="reroll-cinematic-ring ring-3" />
          <div className="reroll-cinematic-rays" />
        </div>
      )}
    </section>
  );
}




