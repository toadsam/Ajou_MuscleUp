import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import UploadDropzone from "../components/UploadDropzone";
import WeeklyGoalCard from "../components/attendance/WeeklyGoalCard";
import "../styles/attendance.css";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";
import { toast as showGlobalToast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";
import { BOX_REASON } from "../lib/collection";

type AttendanceLog = {
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
  mediaUrls?: string[] | null;
  shared?: boolean;
  shareSlug?: string | null;
  cheerCount?: number | null;
  editCount?: number | null;
  lastEditedAt?: string | null;
  expEarned?: number | null;
  updatedAt?: string | null;
  /** 이번 출석으로 주간 목표를 처음 채웠을 때만 */
  weeklyGoalBonus?: number | null;
  weeklyGoalStreak?: number | null;
  /** 이번 출석으로 받은 보상 상자(WEEKLY_GOAL · LUCKY)와 새로 모은 도감 업적 */
  rewardBox?: string | null;
  unlockedItems?: string[] | null;
};

type AttendanceSummary = {
  monthWorkoutCount: number;
  currentStreak: number;
  bestStreakInMonth?: number | null;
};

type AttendanceShareResponse = {
  shareSlug: string;
};
type RankingItem = { userId: number; nickname: string; score: number };

type Toast = { type: "success" | "error"; message: string; expEarned?: number | null };
type WorkoutOption = { id: string; label: string; icon: string; hint: string };
type IntensityOption = { id: string; label: string; tag: string; power: number };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url.split("?")[0]);

const WORKOUT_TYPES: WorkoutOption[] = [
  { id: "weight", label: "웨이트", icon: "W", hint: "근육 펌핑" },
  { id: "cardio", label: "유산소", icon: "C", hint: "심폐 강화" },
  { id: "stretch", label: "스트레칭", icon: "S", hint: "회복 모드" },
];

const INTENSITIES: IntensityOption[] = [
  { id: "light", label: "가벼움", tag: "회복", power: 1 },
  { id: "normal", label: "보통", tag: "루틴", power: 2 },
  { id: "hard", label: "강함", tag: "도전", power: 3 },
];

const MEMO_KEYWORDS = ["3대", "갱신", "PR", "데드", "스쿼트"] as const;
const STREAK_MILESTONES = [3, 7, 14, 30];
const SHARE_COMMENT_TEMPLATES = [
  "오늘도 루틴 완료. 내일도 간다.",
  "기록이 쌓이면 결과가 된다.",
  "작은 출석이 큰 변화를 만든다.",
];

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
    showGlobalToast("로그인이 필요해요. 로그인 화면으로 이동할게요.", "error");
    window.location.href = "/login";
    throw new Error("로그인이 필요해요.");
  }
  if (!res.ok) {
    throw await httpError(res, "요청을 처리하지 못했어요.");
  }
  return res.json();
}

const formatMonthKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfWeek = (date: Date) => {
  const clone = new Date(date);
  const day = (clone.getDay() + 6) % 7;
  clone.setDate(clone.getDate() - day);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const streakBonus = (streak: number) => {
  if (streak >= 30) return 6;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  return 0;
};

// ---------- 표현용 부품 (로직 없음) ----------

function StrokeIcon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <StrokeIcon size={size}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </StrokeIcon>
);

const CrossIcon = ({ size = 16 }: { size?: number }) => (
  <StrokeIcon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </StrokeIcon>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <span className={`att-chevron ${open ? "open" : ""}`}>
    <StrokeIcon size={14}>
      <path d="M6 9l6 6 6-6" />
    </StrokeIcon>
  </span>
);

const PencilIcon = () => (
  <StrokeIcon size={12}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </StrokeIcon>
);

const CameraIcon = () => (
  <StrokeIcon size={12}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <circle cx="12" cy="13.5" r="3.5" />
    <path d="M9 7l1.5-3h3L15 7" />
  </StrokeIcon>
);

function WorkoutIcon({ id }: { id: string }) {
  if (id === "cardio") {
    return (
      <StrokeIcon size={22}>
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </StrokeIcon>
    );
  }
  if (id === "stretch") {
    return (
      <StrokeIcon size={22}>
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 7v6l-4 7M12 13l4 7M5 9.5l7 0.5 7-0.5" />
      </StrokeIcon>
    );
  }
  return (
    <StrokeIcon size={22}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </StrokeIcon>
  );
}

// 처음 화면에 보일 때 0 에서 값까지 굴러 올라가는 숫자
function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const shown = useCountUp(value, { duration, start: inView });
  return (
    <span ref={ref} className="tabular-nums">
      {Math.round(shown)}
    </span>
  );
}

const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function Attendance() {
  const [month, setMonth] = useState(() => new Date());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [didWorkout, setDidWorkout] = useState(true);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [workoutIntensity, setWorkoutIntensity] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [shareComment, setShareComment] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  // 오늘 기록이 이미 있으면 맨 위에 요약만 보여 주고, "기록 고치기"를 눌렀을 때만 입력 폼을 편다.
  const [editingToday, setEditingToday] = useState(false);
  // 오늘 출석 기록. 맨 위 출석 카드가 다른 달을 볼 때도 오늘 기준으로 동작하도록 달력 목록과 따로 둔다.
  // (예전에는 이번 달 목록에서만 찾아서, 달을 넘기면 오늘 기록이 없는 것처럼 보이고 "출석 기록 저장"이 나왔다)
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [weeklyRank, setWeeklyRank] = useState<RankingItem[]>([]);
  const [mediaRank, setMediaRank] = useState<RankingItem[]>([]);
  const [mobileStep, setMobileStep] = useState<"record" | "media" | "share">("record");
  const [showCalendarCard, setShowCalendarCard] = useState(false);
  const [showInsightCards, setShowInsightCards] = useState(false);
  // 표현용: 저장이 끝날 때마다 1 씩 올라가 원판 '철컥' 연출을 다시 재생한다.
  const [plateKey, setPlateKey] = useState(0);
  const [gaugeRef, gaugeInView] = useInView<HTMLDivElement>();
  const appOrigin = window.location.origin;
  const publicShareOrigin = API_BASE || window.location.origin;
  const appShareLinkForSlug = (slug: string) => `${appOrigin}/attendance/share/${slug}`;
  const publicShareLinkForSlug = (slug: string) => `${publicShareOrigin}/share/attendance/${slug}`;

  const monthKey = formatMonthKey(month);
  const todayKey = formatDateKey(new Date());

  const reloadMonth = async () => {
    const [logsRes, summaryRes, weeklyRes, mediaRes] = await Promise.all([
      api<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
      api<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
      api<RankingItem[]>(`/api/attendance/rankings/weekly-streak?limit=5`),
      api<RankingItem[]>(`/api/attendance/rankings/monthly-media?month=${monthKey}&limit=5`),
    ]);
    setLogs(logsRes);
    // 이번 달을 불러왔을 때만 "오늘 기록"을 갱신한다. 다른 달을 보고 있어도 맨 위 출석 카드는 오늘 기준.
    if (monthKey === formatMonthKey(new Date())) {
      setTodayLog(logsRes.find((log) => log.date === todayKey) ?? null);
    }
    setSummary(summaryRes);
    setWeeklyRank(weeklyRes);
    setMediaRank(mediaRes);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await reloadMonth();
      } catch (e: unknown) {
        setError(friendlyError(e, "출석 기록을 불러오지 못했어요."));
      } finally {
        setLoading(false);
      }
    })();
  }, [monthKey]);

  useEffect(() => {
    setSelectedDateKey(null);
  }, [monthKey]);

  const hasTodayLog = Boolean(todayLog);

  useEffect(() => {
    if (todayLog) {
      setDidWorkout(todayLog.didWorkout);
      setMemo(todayLog.memo ?? "");
      setShareComment(todayLog.shareComment ?? "");
      setWorkoutTypes(todayLog.workoutTypes ?? []);
      setWorkoutIntensity(todayLog.workoutIntensity ?? null);
      setMediaUrls(todayLog.mediaUrls ?? []);
      return;
    }
    setDidWorkout(true);
    setMemo("");
    setShareComment("");
    setWorkoutTypes([]);
    setWorkoutIntensity(null);
    setMediaUrls([]);
  }, [todayLog]);

  useEffect(() => {
    if (!didWorkout) {
      setWorkoutTypes([]);
      setWorkoutIntensity(null);
    }
  }, [didWorkout]);

  const logMap = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    logs.forEach((log) => map.set(log.date, log));
    return map;
  }, [logs]);

  const selectedLog = useMemo(() => {
    if (!selectedDateKey) return null;
    return logMap.get(selectedDateKey) ?? null;
  }, [selectedDateKey, logMap]);

  const calendarCells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, idx) => {
      const day = idx - firstDay + 1;
      if (day < 1 || day > daysInMonth) return null;
      const date = new Date(year, monthIndex, day);
      return { day, key: formatDateKey(date) };
    });
  }, [month]);

  const weekStats = useMemo(() => {
    const start = startOfWeek(new Date());
    const typeCounts: Record<string, number> = { weight: 0, cardio: 0, stretch: 0 };
    let intensityTotal = 0;
    let intensityCount = 0;
    let workoutDays = 0;

    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const key = formatDateKey(date);
      const log = logMap.get(key);
      if (log?.didWorkout) {
        workoutDays += 1;
        (log.workoutTypes ?? []).forEach((type) => {
          if (typeCounts[type] !== undefined) typeCounts[type] += 1;
        });
        if (log.workoutIntensity) {
          const intensity = INTENSITIES.find((item) => item.id === log.workoutIntensity);
          if (intensity) {
            intensityTotal += intensity.power;
            intensityCount += 1;
          }
        }
      }
      return { key, log };
    });

    const mostType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const avgIntensity = intensityCount ? intensityTotal / intensityCount : 0;

    return { days, workoutDays, mostType, avgIntensity };
  }, [logMap]);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2200);
  };

  const saveToday = async () => {
    try {
      setSaving(true);
      // 새 출석은 POST /today, 이미 있는 오늘 기록 수정만 PUT /{오늘 날짜}
      const res = await api<AttendanceLog>(hasTodayLog ? `/api/attendance/${todayKey}` : "/api/attendance/today", {
        method: hasTodayLog ? "PUT" : "POST",
        body: JSON.stringify({
          didWorkout,
          memo: memo.trim() || null,
          shareComment: shareComment.trim() || null,
          workoutTypes: didWorkout ? workoutTypes : [],
          workoutIntensity: didWorkout ? workoutIntensity : null,
          mediaUrls,
        }),
      });
      setTodayLog((prev) => ({ ...(prev ?? {}), ...res, date: todayKey }));
      localStorage.setItem("attendanceCompletedAt", todayKey);
      showToast({
        type: "success",
        message: hasTodayLog ? "오늘 기록을 수정했어요." : didWorkout ? "오늘의 기록 완료!" : "휴식도 기록했어요.",
        expEarned: res.expEarned ?? 0,
      });
      if (res.weeklyGoalBonus) {
        showGlobalToast(`주간 목표 달성! ${res.weeklyGoalStreak ?? 1}주 연속 · 보너스 +${res.weeklyGoalBonus}`, "success");
      }
      if (res.rewardBox) {
        showGlobalToast(`${BOX_REASON[res.rewardBox] ?? "보상 상자"}를 받았어요! 도감에서 열어 보세요.`, "success", 4000);
      }
      if (res.unlockedItems && res.unlockedItems.length > 0) {
        showGlobalToast(`도감에 새로 모았어요: ${res.unlockedItems.join(", ")}`, "success", 4000);
      }
      await reloadMonth();
      setPlateKey((prev) => prev + 1);
      setEditingToday(false);
    } catch (e: unknown) {
      showToast({ type: "error", message: friendlyError(e, "저장하지 못했어요. 다시 시도해 주세요.") });
    } finally {
      setSaving(false);
    }
  };

  const ensureShareSlug = async () => {
    if (!todayLog) {
      throw new Error("먼저 오늘 출석을 저장해 주세요.");
    }
    if (todayLog.shareSlug) {
      return todayLog.shareSlug;
    }
    const res = await api<AttendanceShareResponse>(`/api/attendance/${todayLog.date}/share`, { method: "POST" });
    return res.shareSlug;
  };

  const copyShareLink = async () => {
    try {
      setSharing(true);
      const slug = await ensureShareSlug();
      const link = publicShareLinkForSlug(slug);
      await navigator.clipboard.writeText(link);
      showToast({ type: "success", message: "자랑 링크를 복사했어요." });
      await reloadMonth();
    } catch (e: unknown) {
      showToast({ type: "error", message: friendlyError(e, "공유 링크를 만들지 못했어요.") });
    } finally {
      setSharing(false);
    }
  };

  // 공유·저장은 공유 카드 화면에서 한다(그 화면이 카드를 그려서 바로 공유/저장).
  // 예전에 이 화면에서 직접 공유하던 코드는 return 뒤에 남아 실행되지 않아 지웠다.
  const quickShare = async () => {
    try {
      if (!todayLog) {
        showToast({ type: "error", message: "먼저 오늘 출석을 저장해 주세요." });
        return;
      }
      setSharing(true);
      const autoSlug = await ensureShareSlug();
      // 새 탭(window.open)은 await 뒤라 모바일에서 팝업 차단에 걸렸다. 같은 탭으로 넘어간다.
      window.location.assign(`${appShareLinkForSlug(autoSlug)}?auto=share&from=attendance`);
    } catch (e: unknown) {
      showToast({ type: "error", message: friendlyError(e, "공유하지 못했어요.") });
    } finally {
      setSharing(false);
    }
  };

  const saveInstaImage = async () => {
    try {
      if (!todayLog) {
        showToast({ type: "error", message: "먼저 오늘 출석을 저장해 주세요." });
        return;
      }
      const autoSlug = await ensureShareSlug();
      window.location.href = `${appShareLinkForSlug(String(autoSlug))}?auto=save&from=attendance`;
    } catch (e: unknown) {
      showToast({ type: "error", message: friendlyError(e, "이미지를 저장하지 못했어요.") });
    }
  };

  const unshareToday = async () => {
    if (!todayLog) return;
    try {
      setSharing(true);
      await api(`/api/attendance/${todayLog.date}/share`, { method: "DELETE" });
      showToast({ type: "success", message: "공유를 해제했어요." });
      await reloadMonth();
    } catch (e: unknown) {
      showToast({ type: "error", message: friendlyError(e, "공유를 해제하지 못했어요.") });
    } finally {
      setSharing(false);
    }
  };

  const goPrevMonth = () => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const toggleWorkoutType = (id: string) => {
    if (!didWorkout) return;
    setWorkoutTypes((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(0, 3)));
  };

  const keywordMatches = useMemo(() => {
    if (!memo.trim()) return [] as string[];
    return MEMO_KEYWORDS.filter((keyword) => memo.includes(keyword));
  }, [memo]);

  const currentStreak = summary?.currentStreak ?? 0;
  const bestStreak = summary?.bestStreakInMonth ?? 0;
  const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > currentStreak) ?? 30;
  const streakProgress = Math.min(currentStreak / nextMilestone, 1);
  const projectedStreak = hasTodayLog ? currentStreak : currentStreak + (didWorkout ? 1 : 0);

  const estimatedExp = useMemo(() => {
    if (hasTodayLog || !didWorkout) return 0;
    const base = 5;
    const typeBonus = workoutTypes.length;
    const intensityBonus = workoutIntensity ? INTENSITIES.find((item) => item.id === workoutIntensity)?.power ?? 0 : 0;
    const memoBonus = memo.trim() ? 1 : 0;
    const keywordBonus = Math.min(keywordMatches.length, 3);
    const mediaBonus = mediaUrls.length > 0 ? 1 : 0;
    return base + typeBonus + intensityBonus + memoBonus + keywordBonus + mediaBonus + streakBonus(projectedStreak);
  }, [didWorkout, workoutTypes, workoutIntensity, memo, keywordMatches.length, projectedStreak, hasTodayLog, mediaUrls.length]);

  const jumpTo = (id: "att-record" | "att-media" | "att-share") => {
    setMobileStep(id === "att-record" ? "record" : id === "att-media" ? "media" : "share");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const titleLabel = `${month.getFullYear()}년 ${String(month.getMonth() + 1).padStart(2, "0")}월`;

  const todayDidWorkout = Boolean(todayLog?.didWorkout);
  const toggleIndex = didWorkout ? 0 : 1;
  const stepIndex = mobileStep === "record" ? 0 : mobileStep === "media" ? 1 : 2;

  const todayDoneSummary = (() => {
    if (!todayLog) return "";
    if (!todayLog.didWorkout) return "오늘은 쉬는 날로 기록했어요.";
    const types = (todayLog.workoutTypes ?? []).map((type) => WORKOUT_TYPES.find((item) => item.id === type)?.label ?? type);
    const intensity = INTENSITIES.find((item) => item.id === todayLog.workoutIntensity)?.label;
    const parts = [types.join(" · "), intensity ? `강도 ${intensity}` : "", todayLog.expEarned ? `EXP +${todayLog.expEarned}` : ""].filter(Boolean);
    return parts.length ? parts.join(" / ") : "오늘 운동을 기록했어요.";
  })();

  const shareActions = todayLog ? (
    <div className="mt-4 flex flex-wrap gap-3">
      <button onClick={quickShare} disabled={sharing} className="share-btn dg-btn dg-btn-primary">
        {sharing ? "공유 중..." : "원클릭 자랑하기"}
      </button>
      <button onClick={copyShareLink} disabled={sharing} className="share-btn dg-btn dg-btn-steel">
        {sharing ? "생성 중..." : todayLog.shareSlug ? "자랑 링크 복사" : "자랑 링크 만들기"}
      </button>
      <button onClick={saveInstaImage} className="share-btn dg-btn dg-btn-steel">
        인스타용 이미지 저장
      </button>
      {todayLog.shared && (
        <button onClick={unshareToday} disabled={sharing} className="share-btn dg-btn dg-btn-steel">
          공유 해제
        </button>
      )}
      <span className="share-stats self-center">응원 {todayLog.cheerCount ?? 0} · 수정 {todayLog.editCount ?? 0}회</span>
    </div>
  ) : null;

  return (
    <section className="attendance-shell">
      <div className="attendance-bg" />
      <div className="attendance-wrap">
        <header className="attendance-hero dg-rise">
          <p className="attendance-eyebrow">오늘의 출석</p>
          <h1>출석 체크</h1>
          <p>운동 기록과 사진/영상을 함께 저장하고, 바로 자랑 링크로 공유해보세요.</p>
        </header>

        {/* 출석 입력은 맨 위. 오늘 이미 기록했으면 요약만 보여 주고 "기록 고치기"로 폼을 연다. */}
        {todayLog && !editingToday ? (
          <div className="attendance-card dg-steel action-card today-done-card dg-rise">
            <div className="action-header">
              <div>
                <h2>오늘 출석 완료</h2>
                <p>{todayDoneSummary}</p>
              </div>
              <div className={`status-pill dg-chip ${todayLog.didWorkout ? "active" : "rest"}`}>
                {todayLog.didWorkout ? "운동 완료" : "휴식"}
              </div>
            </div>
            {todayLog.memo?.trim() && <p className="today-done-memo dg-whiteboard whitespace-pre-line">{todayLog.memo}</p>}
            {shareActions}
            <div>
              <button type="button" className="ghost-btn dg-btn dg-btn-steel" onClick={() => setEditingToday(true)}>
                오늘 기록 고치기
              </button>
              {todayLog.didWorkout && (
                <Link to="/workout" className="ghost-btn dg-btn dg-btn-steel ml-2">
                  무게 · 횟수 기록하기
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className={`attendance-card dg-steel action-card ${mobileStep === "share" ? "has-mobile-save-gap" : ""}`}>
            <div className="action-header">
              <div>
                <h2>{hasTodayLog ? "오늘 기록 고치기" : "오늘의 운동 체크"}</h2>
                <p>기록 + 사진/영상까지 남기고 자랑 링크를 만들어보세요.</p>
              </div>
              <div key={didWorkout ? "on" : "off"} className={`status-pill dg-chip dg-pop ${didWorkout ? "active" : "rest"}`}>
                {didWorkout ? "운동 완료" : "휴식"}
              </div>
              {hasTodayLog && (
                <button type="button" className="ghost-btn dg-btn dg-btn-steel" onClick={() => setEditingToday(false)}>
                  접기
                </button>
              )}
            </div>

            <div className="attendance-mobile-steps" style={{ "--i": stepIndex } as CSSProperties}>
              <span className="step-slider" aria-hidden="true" />
              <button type="button" onClick={() => jumpTo("att-record")} className={`step-btn ${mobileStep === "record" ? "active" : ""}`}>
                1단계 기록
              </button>
              <button type="button" onClick={() => jumpTo("att-media")} className={`step-btn ${mobileStep === "media" ? "active" : ""}`}>
                2단계 미디어
              </button>
              <button type="button" onClick={() => jumpTo("att-share")} className={`step-btn ${mobileStep === "share" ? "active" : ""}`}>
                3단계 공유
              </button>
            </div>

            <div id="att-record" className={`stack-section ${mobileStep !== "record" ? "step-mobile-hidden" : ""}`}>
            <div className="action-row">
              <div className={`toggle-group ${didWorkout ? "" : "is-rest"}`} style={{ "--i": toggleIndex } as CSSProperties}>
                <span className="toggle-slider" aria-hidden="true" />
                <button onClick={() => setDidWorkout(true)} className={`toggle-btn ${didWorkout ? "selected" : ""}`} aria-pressed={didWorkout}>운동했다</button>
                <button onClick={() => setDidWorkout(false)} className={`toggle-btn ${!didWorkout ? "selected" : ""}`} aria-pressed={!didWorkout}>쉬었다</button>
              </div>
              {hasTodayLog && <span className="lock-badge">오늘 기록 있음 (수정 가능)</span>}
            </div>

            <div className={`action-grid ${!didWorkout ? "disabled" : ""}`}>
              {WORKOUT_TYPES.map((option) => {
                const active = workoutTypes.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleWorkoutType(option.id)}
                    className={`workout-chip ${active ? "active" : ""}`}
                    disabled={!didWorkout}
                    aria-pressed={active}
                  >
                    <span className="chip-icon"><WorkoutIcon id={option.id} /></span>
                    <span className="chip-text"><strong>{option.label}</strong><small>{option.hint}</small></span>
                    <span className="chip-check" aria-hidden="true">{active && <CheckIcon size={14} />}</span>
                  </button>
                );
              })}
            </div>

            <div className={`intensity-row ${!didWorkout ? "disabled" : ""}`}>
              {INTENSITIES.map((option) => {
                const active = workoutIntensity === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setWorkoutIntensity(option.id)}
                    className={`intensity-chip ${active ? "active" : ""}`}
                    disabled={!didWorkout}
                    aria-pressed={active}
                  >
                    <span className="power-meter" aria-hidden="true">
                      {[1, 2, 3].map((level) => (
                        <i key={level} className={level <= option.power ? "on" : ""} />
                      ))}
                    </span>
                    <span className="chip-text"><strong>{option.label}</strong><small>{option.tag}</small></span>
                  </button>
                );
              })}
            </div>

            <div className="memo-block memo-board dg-whiteboard">
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} rows={3} placeholder="오늘 운동 한 줄 요약" />
              <div className="memo-meta">
                <span className="font-num">{memo.length}/200</span>
                <span className="keyword-tag">
                  보너스 키워드:{" "}
                  {keywordMatches.length
                    ? keywordMatches.map((keyword) => (
                        <span key={keyword} className="keyword-chip dg-pop">{keyword}</span>
                      ))
                    : "-"}
                </span>
              </div>
            </div>

            <div className="memo-block">
              <textarea value={shareComment} onChange={(e) => setShareComment(e.target.value)} maxLength={280} rows={2} placeholder="공유할 자랑 멘트 (선택)" />
              <div className="memo-meta">
                <span className="font-num">{shareComment.length}/280</span>
                <div className="flex flex-wrap gap-2">
                  {SHARE_COMMENT_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setShareComment(template)}
                      className={`template-chip ${shareComment === template ? "active" : ""}`}
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            </div>

            <div id="att-media" className={`stack-section ${mobileStep !== "media" ? "step-mobile-hidden" : ""}`}>
            <div className="space-y-3">
              <p className="text-sm text-steel-300">사진/영상 첨부 (최대 10개)</p>
              <p className="text-xs text-emerald-300">사진 없이도 출석 기록과 공유가 가능합니다.</p>
              <UploadDropzone
                onUploaded={(url) => setMediaUrls((prev) => (prev.length >= 10 ? prev : [...prev, url]))}
                accept="image/*,video/*"
                multiple
                folder="attendance"
              />
              {mediaUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {mediaUrls.map((rawUrl, idx) => {
                    const url = withBase(rawUrl);
                    return (
                      <div key={rawUrl} className="dg-well overflow-hidden dg-plate-in">
                        {isVideo(url) ? <video src={url} className="w-full h-24 object-cover" controls /> : <img src={url} alt={`오늘 첨부한 사진 ${idx + 1}`} className="w-full h-24 object-cover" />}
                        <button type="button" onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== rawUrl))} className="media-remove" aria-label={`첨부 ${idx + 1} 삭제`}>
                          삭제
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            </div>

            <div id="att-share" className={`stack-section ${mobileStep !== "share" ? "step-mobile-hidden" : ""}`}>
            <div className="action-footer">
              <div className="att-rack">
                <div key={`bar-${plateKey}`} className={`att-bar ${plateKey ? "landed" : ""}`} aria-hidden="true">
                  <span className="att-bar-shaft" />
                  <span className="att-bar-stop" />
                  <span className="att-bar-sleeve">
                    {hasTodayLog ? (
                      <span
                        className={`att-plate ${todayDidWorkout ? "red" : "steel"} ${plateKey ? "dg-plate-in" : ""}`}
                        style={{ "--from": "64px" } as CSSProperties}
                      >
                        {todayDidWorkout && <b className="font-num">25</b>}
                      </span>
                    ) : (
                      <span className="att-plate ghost" />
                    )}
                    <span className="att-bar-collar" />
                  </span>
                  {plateKey > 0 && hasTodayLog && (
                    <span className="att-puff">
                      {Array.from({ length: 8 }, (_, i) => (
                        <i key={i} style={{ "--a": `${i * 45}deg` } as CSSProperties} />
                      ))}
                    </span>
                  )}
                </div>
                <div className="reward-preview">
                  <span>예상 EXP</span>
                  <strong className="font-num">{didWorkout ? <>+<CountUp value={estimatedExp} duration={500} /></> : "+0"}</strong>
                  <small>스트릭 + 미디어 보너스 포함</small>
                </div>
              </div>
              <button onClick={saveToday} disabled={saving} className="primary-btn dg-btn dg-btn-primary section-save-btn">
                {saving ? "저장 중..." : hasTodayLog ? "출석 기록 수정 저장" : "출석 기록 저장"}
              </button>
            </div>

            {todayLog && shareActions}
            </div>

            <div className={`mobile-save-bar ${mobileStep === "share" ? "show" : ""}`}>
              <div className="mobile-save-meta">
                <strong className="font-num">{didWorkout ? `EXP +${estimatedExp}` : "휴식 모드"}</strong>
                <span>{hasTodayLog ? "오늘 기록 수정" : "오늘 기록 저장"}</span>
              </div>
              <button onClick={saveToday} disabled={saving} className="primary-btn dg-btn dg-btn-primary mobile-save-btn">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}

        <WeeklyGoalCard refreshKey={plateKey} />

        <div className="mobile-top-summary">
          <div className="mobile-summary-badges">
            <span className="mobile-summary-badge dg-chip">이번달 운동 {summary?.monthWorkoutCount ?? 0}일</span>
            <span className="mobile-summary-badge dg-chip">현재 스트릭 {currentStreak}일</span>
          </div>
          <div className="mobile-summary-actions">
            <button
              type="button"
              className="ghost-btn dg-btn dg-btn-steel"
              onClick={() => setShowCalendarCard((prev) => !prev)}
              aria-expanded={showCalendarCard}
            >
              <ChevronIcon open={showCalendarCard} />
              {showCalendarCard ? "캘린더 닫기" : "캘린더 펼치기"}
            </button>
            <button
              type="button"
              className="ghost-btn dg-btn dg-btn-steel"
              onClick={() => setShowInsightCards((prev) => !prev)}
              aria-expanded={showInsightCards}
            >
              <ChevronIcon open={showInsightCards} />
              {showInsightCards ? "통계 닫기" : "통계 펼치기"}
            </button>
          </div>
        </div>

        <div className="attendance-grid">
          <div className={`attendance-card dg-steel calendar-card mobile-collapsible ${showCalendarCard ? "is-open" : ""}`}>
            <div className="calendar-header">
              <div>
                <h2>월간 캘린더</h2>
                <p>운동/휴식/메모를 한눈에 볼 수 있어요.</p>
              </div>
              <div className="calendar-nav">
                <button onClick={goPrevMonth} className="ghost-btn dg-btn dg-btn-steel">이전</button>
                <span key={monthKey} className="calendar-title font-num dg-pop">{titleLabel}</span>
                <button onClick={goNextMonth} className="ghost-btn dg-btn dg-btn-steel">다음</button>
              </div>
            </div>

            {loading && (
              <div className="muted att-loading">
                <span className="dg-loading-plates" aria-hidden="true"><i /><i /><i /><i /></span>
                불러오는 중...
              </div>
            )}
            {error && <div className="error-text">{error}</div>}

            <div className="calendar-weekdays">
              {/* 날짜 칸은 getDay()(일요일=0) 기준으로 채우므로 머리글도 일요일부터 */}
              {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="calendar-grid" key={monthKey}>
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} className="calendar-cell empty" />;
                const log = logMap.get(cell.key);
                const did = log?.didWorkout;
                const hasMemo = Boolean(log?.memo?.trim());
                const hasMedia = (log?.mediaUrls?.length ?? 0) > 0;
                const isToday = cell.key === todayKey;
                const isSelectable = Boolean(log);
                const isSelected = selectedDateKey === cell.key;
                return (
                  <div
                    key={cell.key}
                    className={`calendar-cell dg-rise ${did ? "done" : log ? "rest" : "none"} ${isToday ? "today" : ""} ${
                      isSelectable ? "cursor-pointer is-selectable" : ""
                    } ${isSelected ? "selected" : ""}`}
                    style={{ animationDelay: `${idx * 12}ms` }}
                    onClick={() => {
                      if (isSelectable) {
                        setSelectedDateKey(cell.key);
                      }
                    }}
                    title={isSelectable ? "기록 조회" : ""}
                  >
                    <div className="calendar-day font-num">{cell.day}</div>
                    <span className="att-disc" aria-hidden="true">
                      <i />
                    </span>
                    <div className="calendar-meta">
                      <span className="sr-only">{did ? "운동" : log ? "휴식" : ""}</span>
                      {hasMemo ? <PencilIcon /> : hasMedia ? <CameraIcon /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`attendance-side mobile-collapsible ${showInsightCards ? "is-open" : ""}`}>
            <div className="attendance-card dg-steel streak-card">
              <div className="streak-header">
                <div>
                  <h3>연속 출석</h3>
                  <p>{currentStreak ? `${currentStreak}일 연속 출석 중` : "다시 시작할 시간"}</p>
                </div>
                <div className={`streak-plate ${currentStreak ? "live" : "off"}`} aria-hidden="true">
                  <strong className="font-num">
                    <CountUp value={currentStreak} />
                  </strong>
                  <small className="font-num">DAYS</small>
                </div>
              </div>
              <div className="streak-progress" ref={gaugeRef}>
                <div
                  className="streak-gauge"
                  role="progressbar"
                  aria-label="다음 보상까지 진행률"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(streakProgress * 100)}
                >
                  {Array.from({ length: nextMilestone }, (_, i) => (
                    <span
                      key={i}
                      className={gaugeInView && i < currentStreak ? "on" : ""}
                      style={{ transitionDelay: `${Math.min(i, 29) * 40}ms` }}
                    />
                  ))}
                </div>
                <div className="streak-meta"><span>다음 보상: {nextMilestone}일</span><span>이번 달 최고 {bestStreak}일</span></div>
              </div>
            </div>

            <div className="attendance-card summary-card dg-whiteboard">
              <h3 className="board-title font-pen">이번 달 요약</h3>
              <div className="summary-row"><span>운동 출석</span><strong><CountUp value={summary?.monthWorkoutCount ?? 0} />일</strong></div>
              <div className="summary-row"><span>현재 스트릭</span><strong><CountUp value={currentStreak} />일</strong></div>
              <div className="summary-row"><span>최고 스트릭</span><strong><CountUp value={bestStreak} />일</strong></div>
            </div>

            <div className="attendance-card dg-steel weekly-card">
              <h3>주간 리포트</h3>
              <div className="weekly-grid">
                {weekStats.days.map((day, idx) => (
                  <div key={day.key} className="weekly-day">
                    <div
                      className={`weekly-dot ${day.log?.didWorkout ? "active" : ""} ${day.key === todayKey ? "today" : ""}`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <i />
                    </div>
                    <span>{WEEK_LABELS[idx]}</span>
                  </div>
                ))}
              </div>
              <div className="weekly-row"><span>이번 주 출석</span><strong className="font-num"><CountUp value={weekStats.workoutDays} duration={600} /> / 7</strong></div>
              <div className="weekly-row"><span>가장 많이 한 운동</span><strong>{weekStats.mostType ? WORKOUT_TYPES.find((item) => item.id === weekStats.mostType)?.label : "-"}</strong></div>
              <div className="weekly-row"><span>평균 강도</span><strong>{weekStats.avgIntensity ? INTENSITIES[Math.round(weekStats.avgIntensity) - 1]?.label : "-"}</strong></div>
            </div>
            <div className="attendance-card dg-steel weekly-card">
              <h3>주간 연속출석 랭킹</h3>
              <div className="rank-list">
                {weeklyRank.length === 0 && <p className="rank-empty">기록 없음</p>}
                {weeklyRank.map((item, idx) => (
                  <div key={item.userId} className="rank-row dg-rise" style={{ animationDelay: `${idx * 50}ms` }}>
                    <span className="rank-name">
                      <span className={`rank-no font-num ${idx === 0 ? "top" : ""}`}>{idx + 1}</span>
                      {item.nickname}
                    </span>
                    <strong className="font-num">{item.score}일</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="attendance-card dg-steel weekly-card">
              <h3>월간 미디어 인증 랭킹</h3>
              <div className="rank-list">
                {mediaRank.length === 0 && <p className="rank-empty">기록 없음</p>}
                {mediaRank.map((item, idx) => (
                  <div key={`m-${item.userId}`} className="rank-row dg-rise" style={{ animationDelay: `${idx * 50}ms` }}>
                    <span className="rank-name">
                      <span className={`rank-no font-num ${idx === 0 ? "top" : ""}`}>{idx + 1}</span>
                      {item.nickname}
                    </span>
                    <strong className="font-num">{item.score}회</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {selectedLog && selectedDateKey && (
          <div key={selectedDateKey} className="attendance-card dg-steel log-view dg-rise space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-chalk">출석 기록 조회</h3>
              <button
                type="button"
                className="ghost-btn dg-btn dg-btn-steel"
                onClick={() => setSelectedDateKey(null)}
              >
                닫기
              </button>
            </div>
            <div className="font-num text-base text-steel-300">{selectedDateKey}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`dg-chip ${selectedLog.didWorkout ? "bg-plate-red text-white" : "bg-steel-700 text-chalk"}`}>
                상태: {selectedLog.didWorkout ? "운동" : "휴식"}
              </span>
              {selectedLog.workoutIntensity && (
                <span className="dg-chip bg-plate-yellow text-black">
                  강도: {selectedLog.workoutIntensity}
                </span>
              )}
              {(selectedLog.workoutTypes ?? []).map((type) => (
                <span key={type} className="dg-chip bg-steel-700 text-chalk">
                  {type}
                </span>
              ))}
            </div>
            <div className="log-memo dg-whiteboard whitespace-pre-line">
              {selectedLog.memo?.trim() || "메모 없음"}
            </div>
            {(selectedLog.mediaUrls?.length ?? 0) > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(selectedLog.mediaUrls ?? []).map((rawUrl, idx) => {
                  const url = withBase(rawUrl);
                  return (
                    <div key={rawUrl} className="dg-well overflow-hidden dg-rise" style={{ animationDelay: `${idx * 50}ms` }}>
                      {isVideo(url) ? (
                        <video src={url} className="w-full h-24 object-cover" controls />
                      ) : (
                        <img src={url} alt={`${selectedDateKey} 출석 사진 ${idx + 1}`} className="w-full h-24 object-cover" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className={`toast ${toast.type} dg-pop`} role="status">
          <span className="toast-icon">{toast.type === "success" ? <CheckIcon size={18} /> : <CrossIcon size={18} />}</span>
          <div>
            <strong>{toast.message}</strong>
            {toast.type === "success" && (toast.expEarned ?? 0) > 0 && <span className="toast-exp font-num">EXP +{toast.expEarned}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
