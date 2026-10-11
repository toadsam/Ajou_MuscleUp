import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { ChalkPuff } from "../components/avatar/TierUpAnimation";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";
import { toast } from "../lib/toast";
import { httpError } from "../lib/httpError";
import { clearGuestCharacter, loadGuestCharacter } from "../components/gymMap/guestCharacter";
import { displayEmail } from "../lib/displayEmail";
import { BlockedUsersSection, WithdrawSection } from "../components/AccountSafety";

// 처음 보일 때 0 에서 값까지 굴러 올라가는 숫자(표현 전용)
function CountNum({ value, suffix = "" }: { value: number | null | undefined; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const current = useCountUp(value ?? 0, { duration: 900, start: inView });
  if (value === null || value === undefined) return <span ref={ref}>-</span>;
  return (
    <span ref={ref}>
      {Math.round(current).toLocaleString("ko-KR")}
      {suffix}
    </span>
  );
}

// 아코디언 열림 표시 화살표
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

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
  createdAt?: string | null;
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
  // 서버가 새로 주는 레벨 진행 정보(없을 수도 있어 모두 선택 값)
  exp?: number | null;
  expToNextLevel?: number | null;
  levelProgress?: number | null; // 0..1
  attendancePoints?: number | null;
  hasBodyStats?: boolean | null;
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

type AttendanceLogLite = {
  date: string;
  didWorkout: boolean;
};

type AttendanceRiskState = "normal" | "warning" | "critical";

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
    toast("로그인이 필요해요. 로그인 화면으로 이동할게요.", "error");
    window.location.href = "/login";
    throw new Error("로그인이 필요해요.");
  }
  if (!res.ok) {
    throw await httpError(res, "정보를 불러오지 못했어요.");
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
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfWeekMonday = (date: Date) => {
  const clone = new Date(date);
  const day = (clone.getDay() + 6) % 7;
  clone.setDate(clone.getDate() - day);
  clone.setHours(0, 0, 0, 0);
  return clone;
};
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
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogLite[]>([]);
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

  // 처음 들어올 때와 "다시 시도" 를 눌렀을 때 같은 순서로 불러온다
  const loadAll = useCallback(async () => {
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
          const now = new Date();
          const monthKeys = [0, 1, 2].map((offset) =>
            formatMonthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)),
          );
          const monthLogs = await Promise.all(
            monthKeys.map((key) => api<AttendanceLogLite[]>(`/api/attendance?month=${key}`)),
          );
          const dedup = new Map<string, AttendanceLogLite>();
          monthLogs.flat().forEach((log) => {
            if (!log?.date) return;
            dedup.set(log.date, log);
          });
          setAttendanceLogs(Array.from(dedup.values()));
        } catch {
          setAttendanceLogs([]);
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
          // 로그인 전 지도에서 만든 체험 캐릭터가 있으면 성별 · MBTI 를 이어받는다
          const guest = loadGuestCharacter();
          setForm(guest ? { ...emptyForm, gender: guest.gender, mbti: guest.mbti } : emptyForm);
          if (guest) showToast({ type: "success", message: "체험 때 만든 캐릭터를 불러왔어요. 키·몸무게만 넣으면 완성!" });
        }
      } catch (e: any) {
        // 서버가 꺼져 있거나 네트워크가 끊기면 fetch 는 TypeError 를 던진다
        const offline = e instanceof TypeError || /failed to fetch|network/i.test(String(e?.message ?? ""));
        setError(
          offline
            ? "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."
            : e?.message || "마이페이지 정보를 불러오지 못했어요.",
        );
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
      clearGuestCharacter();
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

  const attendanceRiskState = useMemo<AttendanceRiskState>(() => {
    if (isResting) return "normal";
    const joinedAt = data?.createdAt ? new Date(data.createdAt) : null;
    const workoutDates = new Set(
      attendanceLogs.filter((log) => log.didWorkout).map((log) => log.date),
    );
    const weekStart = startOfWeekMonday(new Date());
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    if (joinedAt && !Number.isNaN(joinedAt.getTime()) && joinedAt > prevWeekStart) return "normal";

    const countWeek = (offsetWeeks: number) => {
      const start = new Date(weekStart);
      start.setDate(start.getDate() - offsetWeeks * 7);
      let count = 0;
      for (let i = 0; i < 7; i += 1) {
        const cursor = new Date(start);
        cursor.setDate(start.getDate() + i);
        if (workoutDates.has(formatDateKey(cursor))) count += 1;
      }
      return count;
    };

    // Completed-week policy: judge by last week, not current in-progress week.
    const prevWeekCount = countWeek(1);
    if (prevWeekCount >= 3) return "normal";

    const prev2WeekCount = countWeek(2);
    if (prev2WeekCount < 3) return "critical";
    return "warning";
  }, [attendanceLogs, isResting, data?.createdAt]);

  const attendanceRiskLabel =
    attendanceRiskState === "critical"
      ? "다시 시작해요"
      : attendanceRiskState === "warning"
        ? "조금 쉬었어요"
        : isResting
          ? "회복/휴식 중"
          : "활동 가능";

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
      attendanceRisk: attendanceRiskState,
    });
  }, [character?.avatarSeed, character?.gender, evolutionBranch, activeSkillIds, customization, stats?.gender, isResting, attendanceRiskState]);

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
    <section className="pt-32 pb-20 px-5 md:px-10 min-h-screen text-chalk">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-plate-yellow">
            내 기록
          </p>
          <h1 className="text-3xl md:text-4xl">마이페이지</h1>
          {data && (
            <p className="text-steel-300">
              {data.nickname}
              {displayEmail(data.email) && ` (${displayEmail(data.email)})`}
            </p>
          )}
        </header>

        {loading &&
          (isMobile ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 animate-pulse rounded-lg border-2 border-black bg-steel-800" />
                <div className="h-20 animate-pulse rounded-lg border-2 border-black bg-steel-800" />
              </div>
              <div className="h-12 animate-pulse rounded-lg border-2 border-black bg-steel-800" />
              <div className="h-14 animate-pulse rounded-lg border-2 border-black bg-steel-800" />
              <div className="h-14 animate-pulse rounded-lg border-2 border-black bg-steel-800" />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-steel-300" role="status">
              <span className="dg-loading-plates" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              불러오는 중...
            </div>
          ))}
        {error && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-l-[6px] border-black border-l-plate-red bg-steel-900 px-4 py-3 text-red-200"
            role="alert"
          >
            <span>{error}</span>
            <button type="button" className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm" onClick={() => void loadAll()} disabled={loading}>
              다시 시도
            </button>
          </div>
        )}

        {isMobile && !loading && !error && (
          <div className="space-y-4 md:hidden">
            <div className="grid grid-cols-2 gap-3">
              <div className="dg-steel dg-rise p-4">
                <p className="text-xs font-semibold text-steel-400">캐릭터 상태</p>
                <p className="mt-2 font-num text-xl leading-tight text-chalk">
                  {character ? (
                    <>
                      <span className="text-plate-yellow">{character.tier}</span> · 단계 {character.evolutionStage}
                    </>
                  ) : (
                    "준비 중"
                  )}
                </p>
                <p className="mt-1 text-xs text-steel-400">{attendanceRiskLabel}</p>
              </div>
              <div className="dg-steel dg-rise p-4" style={{ animationDelay: "60ms" }}>
                <p className="text-xs font-semibold text-steel-400">현재 랭크</p>
                <p className="mt-1 font-num text-3xl leading-none text-chalk">
                  #<CountNum value={rank?.myRank} />
                </p>
                <p className="mt-1 text-xs text-steel-400">상위 {rank?.myTopPercent ?? "-"}%</p>
              </div>
            </div>

            {character && (
              <div>
                <p className="px-1 text-xs font-semibold text-steel-400">내 캐릭터 미리보기</p>
                <div className="mt-2">
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

            <Link
              to="/attendance"
              className="dg-chalk-burst flex items-center justify-between rounded-lg border-[3px] border-black bg-plate-red px-4 py-3 text-white shadow-md transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            >
              <span>
                <span className="block text-xs font-semibold text-white/80">오늘 해야 할 1개</span>
                <span className="mt-0.5 block font-display text-lg">출석 체크하러 가기</span>
              </span>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>

            <div className="dg-steel overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMobileSection("stats")}
                aria-expanded={mobileOpenSections.stats}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-steel-700/60"
              >
                <span className="font-display text-base">통계</span>
                <span className="flex items-center gap-1 text-sm text-steel-400">
                  {mobileOpenSections.stats ? "접기" : "펼치기"}
                  <Chevron open={mobileOpenSections.stats} />
                </span>
              </button>
              {mobileOpenSections.stats && (
                <div className="dg-rise grid grid-cols-2 gap-2 border-t-2 border-black p-3">
                  {statInputs.map((field) => (
                    <label key={`m-${field.key}`} className="text-xs font-semibold text-steel-300">
                      <span>{field.label}</span>
                      {field.key === "gender" ? (
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, gender: "MALE" }))}
                            className={`flex-1 rounded-md border-2 border-black px-2 py-1 text-[11px] font-bold transition ${form.gender === "MALE" ? "bg-plate-red text-white shadow-[0_2px_0_#0E0E10]" : "bg-steel-700 text-steel-300"}`}
                          >
                            남
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, gender: "FEMALE" }))}
                            className={`flex-1 rounded-md border-2 border-black px-2 py-1 text-[11px] font-bold transition ${form.gender === "FEMALE" ? "bg-plate-red text-white shadow-[0_2px_0_#0E0E10]" : "bg-steel-700 text-steel-300"}`}
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
                          className="mt-1 w-full rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-2 py-1.5 text-sm"
                        />
                      )}
                    </label>
                  ))}
                  <button
                    onClick={saveStats}
                    disabled={saving}
                    className="dg-btn dg-btn-primary col-span-2 mt-1 px-4 py-2 text-sm"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              )}
            </div>

            <div className="dg-steel overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMobileSection("gear")}
                aria-expanded={mobileOpenSections.gear}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-steel-700/60"
              >
                <span className="font-display text-base">장비</span>
                <span className="flex items-center gap-1 text-sm text-steel-400">
                  {mobileOpenSections.gear ? "접기" : "펼치기"}
                  <Chevron open={mobileOpenSections.gear} />
                </span>
              </button>
              {mobileOpenSections.gear && (
                <div className="dg-rise space-y-3 border-t-2 border-black p-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => void toggleResting()} aria-pressed={isResting} className={`dg-btn px-3 py-1.5 text-xs ${isResting ? "bg-plate-blue text-white" : "dg-btn-steel"}`}>
                      {isResting ? "휴식중" : "휴식 모드"}
                    </button>
                    <button onClick={rerollAvatar} disabled={rerolling} className="dg-btn dg-btn-steel px-3 py-1.5 text-xs">
                      {rerolling ? "리롤 중..." : "다시 만들기"}
                    </button>
                    <button onClick={togglePublic} disabled={publicUpdating} aria-pressed={Boolean(character?.isPublic)} className={`dg-btn px-3 py-1.5 text-xs ${character?.isPublic ? "bg-plate-green text-white" : "dg-btn-steel"}`}>
                      {character?.isPublic ? "공개 중" : "비공개"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["face", "body", "emblem"] as CustomPart[]).map((part) => {
                      const unlocked = unlockedParts[part];
                      const image = customization[part];
                      return (
                        <div key={`m-part-${part}`} className="dg-well p-2">
                          <p className="text-[11px] font-semibold text-chalk">{CUSTOM_PART_LABEL[part]}</p>
                          <div className="mt-1 h-16 overflow-hidden rounded border-2 border-black bg-steel-950">
                            {image ? (
                              <img loading="lazy" decoding="async" src={image} alt={`${part} custom`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-steel-400">{unlocked ? "이미지 없음" : "잠김"}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="dg-steel overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMobileSection("logs")}
                aria-expanded={mobileOpenSections.logs}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-steel-700/60"
              >
                <span className="font-display text-base">로그</span>
                <span className="flex items-center gap-1 text-sm text-steel-400">
                  {mobileOpenSections.logs ? "접기" : "펼치기"}
                  <Chevron open={mobileOpenSections.logs} />
                </span>
              </button>
              {mobileOpenSections.logs && (
                <div className="dg-rise space-y-2 border-t-2 border-black p-3">
                  {data?.recentAiChats?.slice(0, 8).map((item, idx) => (
                    <div key={`m-ai-${idx}`} className="dg-well dg-rise p-2" style={{ animationDelay: `${idx * 50}ms` }}>
                      <p className="text-[11px] text-gray-400">{formatDate(item.createdAt)}</p>
                      <p className="text-xs font-semibold text-white">Q. {item.question}</p>
                      <p className="text-xs text-gray-300 line-clamp-3">A. {item.answer}</p>
                    </div>
                  ))}
                  {(!data?.recentAiChats || data.recentAiChats.length === 0) && <p className="text-xs text-gray-400">AI 기록이 없습니다.</p>}
                </div>
              )}
            </div>

            <div className="dg-steel overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMobileSection("feedback")}
                aria-expanded={mobileOpenSections.feedback}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-steel-700/60"
              >
                <span className="font-display text-base">공개 피드백</span>
                <span className="flex items-center gap-1 text-sm text-steel-400">
                  {mobileOpenSections.feedback ? "접기" : "펼치기"}
                  <Chevron open={mobileOpenSections.feedback} />
                </span>
              </button>
              {mobileOpenSections.feedback && (
                <div className="dg-rise space-y-2 border-t-2 border-black p-3">
                  <div className="space-y-2">
                    {(data?.recentComments ?? []).slice(0, 6).map((c) => (
                      <div key={`m-c-${c.id}`} className="dg-well p-2">
                        <p className="text-[11px] text-gray-400">{c.authorNickname || "익명"} · {formatDate(c.createdAt)}</p>
                        <p className="text-xs text-gray-200 line-clamp-2">{c.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(data?.recentLikes ?? []).slice(0, 6).map((p) => (
                      <a key={`m-l-${p.id}`} href={`/brag/${p.id}`} className="dg-well block p-2 transition hover:-translate-y-0.5 hover:shadow-md">
                        <p className="text-xs font-semibold text-red-300 line-clamp-1">{p.title}</p>
                        <p className="text-[11px] text-steel-400">좋아요 <span className="font-num text-xs text-chalk">{p.likeCount ?? 0}</span></p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hidden gap-6 md:grid lg:grid-cols-[1.15fr,1fr]">
          <div className="dg-steel dg-rise p-6 space-y-5 self-start">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">내 스탯 입력</h2>
              {stats?.updatedAt && (
                <span className="text-xs text-steel-400">최근 저장 {formatDate(stats.updatedAt)}</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {statInputs.map((field) => (
                <label key={field.key} className="text-sm font-semibold text-steel-300 space-y-2">
                  <span>{field.label}</span>
                  {field.key === "gender" ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, gender: "MALE" }))}
                        aria-pressed={form.gender === "MALE"}
                        className={`rounded-md border-2 border-black px-5 py-2 text-xs font-bold transition active:translate-y-0.5 ${
                          form.gender === "MALE" ? "bg-plate-red text-white shadow-[0_3px_0_#0E0E10]" : "bg-steel-700 text-steel-300 hover:bg-steel-600"
                        }`}
                      >
                        남
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, gender: "FEMALE" }))}
                        aria-pressed={form.gender === "FEMALE"}
                        className={`rounded-md border-2 border-black px-5 py-2 text-xs font-bold transition active:translate-y-0.5 ${
                          form.gender === "FEMALE" ? "bg-plate-red text-white shadow-[0_3px_0_#0E0E10]" : "bg-steel-700 text-steel-300 hover:bg-steel-600"
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
                      className="w-full rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-4 py-2 text-sm"
                      maxLength={4}
                    />
                  ) : (
                    <input
                      type="number"
                      step={field.step}
                      placeholder={field.placeholder}
                      value={form[field.key as keyof StatsForm] as string}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-4 py-2 text-sm"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-400">몸무게는 필수 입력입니다.</span>
              <button
                onClick={saveStats}
                disabled={saving}
                className="dg-btn dg-btn-primary px-6 py-2 text-sm"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {character ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">내 캐릭터</h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => void toggleResting()}
                    aria-pressed={isResting}
                    className={`dg-btn px-4 py-2 text-xs ${isResting ? "bg-plate-blue text-white" : "dg-btn-steel"}`}
                  >
                    {isResting ? "휴식중" : "휴식 모드"}
                  </button>
                  <button
                    onClick={rerollAvatar}
                    disabled={rerolling}
                    className="dg-btn dg-btn-steel px-4 py-2 text-xs"
                  >
                    {rerolling ? "리롤 중..." : "다시 만들기"}
                  </button>
                  <button
                    onClick={togglePublic}
                    disabled={publicUpdating}
                    aria-pressed={character.isPublic}
                    className={`dg-btn px-4 py-2 text-xs ${character.isPublic ? "bg-plate-green text-white" : "dg-btn-steel"}`}
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
                attendanceRisk={attendanceRiskState}
                change={change}
                customization={customization}
                rerollBurstNonce={rerollBurstNonce}
                evolutionBranch={evolutionBranch}
                unlockedSkills={skillUnlocks}
                skillEnabledMap={skillEnabledMap}
                onToggleSkill={toggleSkillEnabled}
              />
              {(typeof character.levelProgress === "number" || character.hasBodyStats === false) && (
                <div className="dg-steel p-4 text-sm text-steel-300 space-y-2">
                  {typeof character.levelProgress === "number" && (
                    <>
                      <div className="flex items-center justify-between text-xs font-semibold text-steel-400">
                        <span>다음 레벨까지</span>
                        <span className="font-num text-sm text-chalk">
                          {typeof character.exp === "number" && typeof character.expToNextLevel === "number"
                            ? `${character.exp} / ${character.expToNextLevel}`
                            : `${Math.round(Math.max(0, Math.min(1, character.levelProgress)) * 100)}%`}
                        </span>
                      </div>
                      <div
                        className="dg-well h-3 overflow-hidden p-0"
                        role="progressbar"
                        aria-label="다음 레벨까지 진행률"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(Math.max(0, Math.min(1, character.levelProgress)) * 100)}
                      >
                        <div className="h-full bg-plate-yellow" style={{ width: `${Math.max(0, Math.min(1, character.levelProgress)) * 100}%` }} />
                      </div>
                    </>
                  )}
                  {character.hasBodyStats === false && (
                    <p className="text-xs text-steel-300">체성분 정보를 입력하면 레벨에 반영돼요.</p>
                  )}
                </div>
              )}
              <div className="dg-steel p-4 text-sm text-steel-300 grid md:grid-cols-2 gap-3">
                <div className="dg-well px-3 py-2">
                  <div className="text-xs font-semibold text-steel-400">티어 정보</div>
                  <div className="text-chalk font-semibold">
                    <span className="font-num text-base text-plate-yellow">{character.tier}</span> · {tierDescriptions[character.tier] ?? "-"}
                  </div>
                </div>
                <div className="dg-well px-3 py-2">
                  <div className="text-xs font-semibold text-steel-400">진화 단계</div>
                  <div className="text-chalk font-semibold">
                    <span className="font-num text-base">{character.evolutionStage}</span>단계 · {stageDescriptions[character.evolutionStage] ?? "성장 중"}
                  </div>
                </div>
                <div className="dg-well px-3 py-2">
                  <div className="text-xs font-semibold text-steel-400">진화 갈래</div>
                  <div className="text-chalk font-semibold">{evolutionBranch ?? "-"}</div>
                </div>
                <div className="dg-well px-3 py-2">
                  <div className="text-xs font-semibold text-steel-400">스킬 해금</div>
                  <div className="font-num text-lg leading-tight text-chalk">
                    {activeSkillCount} <span className="text-steel-500">/ {skillUnlocks.length}</span>
                  </div>
                </div>
                <div className="dg-well px-3 py-2 md:col-span-2">
                  <div className="text-xs font-semibold text-steel-400">컨디션</div>
                  <div className={`flex items-center gap-2 font-semibold ${attendanceRiskState === "critical" || attendanceRiskState === "warning" ? "text-yellow-300" : isResting ? "text-blue-300" : "text-chalk"}`}>
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 rounded-full border border-black ${attendanceRiskState === "critical" || attendanceRiskState === "warning" ? "bg-plate-yellow" : isResting ? "bg-plate-blue" : "bg-plate-green"}`}
                    />
                    {attendanceRiskLabel}
                  </div>
                </div>
              </div>
              <div className="dg-steel p-4 text-sm text-steel-300 flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-xs font-semibold text-steel-400">내 순위</div>
                  <div className="font-num text-4xl leading-none text-chalk">
                    {rank?.myRank !== undefined && rank?.myRank !== null ? <>#<CountNum value={rank.myRank} /></> : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-steel-400">상위 비율</div>
                  <div className="font-num text-4xl leading-none text-plate-yellow">{rank?.myTopPercent !== undefined && rank?.myTopPercent !== null ? `${rank.myTopPercent}%` : "-"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-steel-400">공개 캐릭터 수</div>
                  <div className="font-num text-4xl leading-none text-chalk"><CountNum value={rank?.totalPublic ?? 0} /></div>
                </div>
                {!character.isPublic && (
                  <div className="text-xs text-steel-400">공개 설정 시 랭킹이 계산됩니다.</div>
                )}
              </div>
              <div className="dg-steel relative overflow-hidden p-4 space-y-4">
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 border-b-2 border-black bg-plate-yellow" />
                <div className="pt-1">
                  <p className="flex items-center gap-2 text-xs font-semibold text-plate-yellow">
                    출석 해금
                  </p>
                  <h3 className="font-display text-lg text-chalk">사진 커스텀 해금</h3>
                  <p className="text-xs text-steel-300">
                    이번 달 운동 출석 <span className="font-num text-sm text-chalk">{attendanceCount}</span>일 기준으로 파트가 열립니다.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(["face", "body", "emblem"] as CustomPart[]).map((part, partIdx) => {
                    const unlocked = unlockedParts[part];
                    const image = customization[part];
                    const need = CUSTOM_UNLOCK_REQUIREMENTS[part];
                    return (
                      <div
                        key={part}
                        className="dg-well dg-rise relative overflow-hidden p-3 pl-4"
                        style={{ animationDelay: `${partIdx * 60}ms` }}
                      >
                        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${unlocked ? "bg-plate-green" : "bg-steel-700"}`} />
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-chalk">{CUSTOM_PART_LABEL[part]}</strong>
                          <span className={`text-[11px] font-semibold ${unlocked ? "text-green-300" : "text-steel-400"}`}>
                            {unlocked ? "해금" : `${need}일 필요`}
                          </span>
                        </div>
                        {!unlocked && (
                          <div className="mt-2 h-2 overflow-hidden rounded-sm border border-black bg-steel-950" aria-hidden="true">
                            <div className="h-full bg-plate-yellow transition-[width] duration-700" style={{ width: `${Math.min(100, (attendanceCount / Math.max(1, need)) * 100)}%` }} />
                          </div>
                        )}
                        <div className="mt-2 h-20 rounded border-2 border-black bg-steel-950 overflow-hidden">
                          {image ? (
                            <img loading="lazy" decoding="async" src={image} alt={`${part} custom`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-steel-400">
                              {unlocked ? "이미지 없음" : "잠김"}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className={`dg-btn dg-btn-steel flex-1 px-2 py-1.5 text-xs ${unlocked ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
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
                            className="dg-btn dg-btn-steel px-2 py-1.5 text-xs"
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
          ) : loading ? (
            <div className="dg-steel flex items-center gap-3 p-6 text-steel-300" role="status">
              <span className="dg-loading-plates" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              캐릭터 정보를 불러오는 중입니다.
            </div>
          ) : (
            <div className="dg-steel flex flex-wrap items-center justify-between gap-3 p-6 text-steel-300" role="status">
              <span>캐릭터 정보를 불러오지 못했어요.</span>
              <button type="button" className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm" onClick={() => void loadAll()}>
                다시 시도
              </button>
            </div>
          )}
        </div>

        {data && (
          <div className="hidden gap-6 md:grid md:grid-cols-2">
            <div className="dg-steel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">최근 댓글</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentComments.length === 0 && <p className="text-gray-400 text-sm">댓글 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentComments.map((c, idx) => (
                  <div key={c.id} className="dg-well dg-rise p-3" style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{c.authorNickname || "익명"}</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-gray-200 mt-1 whitespace-pre-line">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="dg-steel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">좋아요한 글</h2>
                <span className="text-sm text-gray-400">최신순</span>
              </div>
              {data.recentLikes.length === 0 && <p className="text-gray-400 text-sm">좋아요 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentLikes.map((p, idx) => (
                  <a
                    key={p.id}
                    href={`/brag/${p.id}`}
                    className="dg-well dg-rise block p-3 transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <p className="font-semibold text-red-300">{p.title}</p>
                      <span className="shrink-0 text-sm text-steel-400">좋아요 <span className="font-num text-base text-chalk">{p.likeCount ?? 0}</span></span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {p.movement || "-"} {p.weight ? `· ${p.weight}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 dg-steel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">AI 사용 기록</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentAiChats.length === 0 && <p className="text-gray-400 text-sm">AI 기록이 없습니다.</p>}
              <div className="grid md:grid-cols-2 gap-3">
                {data.recentAiChats.map((item, idx) => (
                  <div key={idx} className="dg-well dg-rise p-3 space-y-1" style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}>
                    <div className="text-xs text-steel-400">{formatDate(item.createdAt)}</div>
                    <p className="text-sm font-semibold text-white">Q. {item.question}</p>
                    <p className="text-sm text-gray-200 whitespace-pre-line">A. {item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data && <BlockedUsersSection />}
        {data && <WithdrawSection />}
      </div>

      {toast && (
        <div
          key={toast.message}
          role="status"
          aria-live="polite"
          className={`dg-plate-in fixed top-24 right-6 z-50 rounded-lg border-[3px] border-black px-4 py-2 text-sm font-semibold shadow-md ${
            toast.type === "success" ? "bg-plate-green text-white" : "bg-plate-red text-white"
          }`}
          style={{ "--from": "60px" } as CSSProperties}
        >
          {toast.message}
        </div>
      )}

      {banner && (
        <div
          className={`fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg border-[3px] border-black px-6 py-2 font-num text-2xl tracking-wide shadow-xl ${
            banner.kind === "evolution"
              ? "bg-plate-blue text-white"
              : banner.kind === "tier"
              ? "bg-plate-yellow text-black"
              : "bg-plate-red text-white"
          }`}
        >
          <span className="dg-pop block">{banner.message}</span>
        </div>
      )}

      {rerollCinematic && (
        // 다시 만들기·진화 순간: 화면 가운데서 원판이 철컥 끼워지고 초크 가루가 퍼진다
        <div className="pointer-events-none fixed inset-0 z-[80]" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2" style={{ translate: "-50% -50%" }}>
            <div className="dg-pop flex h-28 w-28 items-center justify-center rounded-full border-[4px] border-black bg-plate-yellow shadow-xl">
              <div className="h-8 w-8 rounded-full border-[3px] border-black bg-steel-800" />
            </div>
          </div>
          <ChalkPuff count={26} spread={170} />
        </div>
      )}
    </section>
  );
}





