import { useEffect, useMemo, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";
import "../styles/attendance.css";
import { renderAttendanceShareCard } from "../utils/attendanceShareCard";

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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [weeklyRank, setWeeklyRank] = useState<RankingItem[]>([]);
  const [mediaRank, setMediaRank] = useState<RankingItem[]>([]);
  const appOrigin = window.location.origin;
  const publicShareOrigin = API_BASE || window.location.origin;
  const appShareLinkForSlug = (slug: string) => `${appOrigin}/attendance/share/${slug}`;
  const publicShareLinkForSlug = (slug: string) => `${publicShareOrigin}/share/attendance/${slug}`;

  const monthKey = formatMonthKey(month);
  const todayKey = formatDateKey(new Date());
  const isCurrentMonth = monthKey === formatMonthKey(new Date());

  const reloadMonth = async () => {
    const [logsRes, summaryRes, weeklyRes, mediaRes] = await Promise.all([
      api<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
      api<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
      api<RankingItem[]>(`/api/attendance/rankings/weekly-streak?limit=5`),
      api<RankingItem[]>(`/api/attendance/rankings/monthly-media?month=${monthKey}&limit=5`),
    ]);
    setLogs(logsRes);
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
      } catch (e: any) {
        setError(e?.message || "출석 기록을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, [monthKey]);

  useEffect(() => {
    setSelectedDateKey(null);
  }, [monthKey]);

  const todayLog = useMemo(() => {
    if (!isCurrentMonth) return null;
    return logs.find((log) => log.date === todayKey) ?? null;
  }, [logs, isCurrentMonth, todayKey]);

  const hasTodayLog = Boolean(todayLog);

  useEffect(() => {
    if (!isCurrentMonth) return;
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
  }, [todayLog, isCurrentMonth]);

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
      localStorage.setItem("attendanceCompletedAt", todayKey);
      showToast({
        type: "success",
        message: hasTodayLog ? "오늘 기록을 수정했어요." : didWorkout ? "오늘의 기록 완료!" : "휴식도 기록했어요.",
        expEarned: res.expEarned ?? 0,
      });
      await reloadMonth();
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "저장에 실패했어요." });
    } finally {
      setSaving(false);
    }
  };

  const composeShareText = (link: string) => {
    const base = shareComment.trim() || memo.trim() || "오늘 출석 완료!";
    return `${base}\n${link}`;
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
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "공유 링크 생성에 실패했어요." });
    } finally {
      setSharing(false);
    }
  };

  const kakaoShare = async () => {
    try {
      setSharing(true);
      const slug = await ensureShareSlug();
      const link = publicShareLinkForSlug(slug);
      window.open(`https://story.kakao.com/share?url=${encodeURIComponent(link)}`, "_blank", "noopener,noreferrer");
      await reloadMonth();
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "카카오 공유에 실패했어요." });
    } finally {
      setSharing(false);
    }
  };

  const quickShare = async () => {
    try {
      setSharing(true);
      const slug = await ensureShareSlug();
      const link = publicShareLinkForSlug(slug);
      const text = composeShareText(link);
      if (navigator.share) {
        await navigator.share({ title: "출석 자랑", text, url: link });
        showToast({ type: "success", message: "공유 창을 열었어요." });
      } else {
        await navigator.clipboard.writeText(text);
        showToast({ type: "success", message: "멘트+링크를 복사했어요." });
      }
      await reloadMonth();
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "공유에 실패했어요." });
    } finally {
      setSharing(false);
    }
  };

  const saveInstaImage = async () => {
    try {
      const mediaImage = (mediaUrls || []).map(withBase).find((url) => !isVideo(url));
      const blob = await renderAttendanceShareCard({
        date: todayKey,
        didWorkout,
        workoutTypes: workoutTypes.map((type) => WORKOUT_TYPES.find((item) => item.id === type)?.label ?? type),
        workoutIntensity: workoutIntensity ? INTENSITIES.find((item) => item.id === workoutIntensity)?.label ?? workoutIntensity : null,
        memo,
        shareComment,
        mediaUrl: mediaImage ?? null,
      });
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = `attendance-card-${todayKey}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileUrl);
      showToast({ type: "success", message: "자랑 카드 이미지를 저장했어요." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "이미지 저장에 실패했어요." });
    }
  };

  const unshareToday = async () => {
    if (!todayLog) return;
    try {
      setSharing(true);
      await api(`/api/attendance/${todayLog.date}/share`, { method: "DELETE" });
      showToast({ type: "success", message: "공유를 해제했어요." });
      await reloadMonth();
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "공유 해제에 실패했어요." });
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

  const titleLabel = `${month.getFullYear()}년 ${String(month.getMonth() + 1).padStart(2, "0")}월`;

  return (
    <section className="attendance-shell">
      <div className="attendance-bg" />
      <div className="attendance-wrap">
        <header className="attendance-hero">
          <p className="attendance-eyebrow">MuscleUp Attendance Engine</p>
          <h1>출석 체크</h1>
          <p>운동 기록과 사진/영상을 함께 저장하고, 바로 자랑 링크로 공유해보세요.</p>
        </header>

        <div className="attendance-grid">
          <div className="attendance-card calendar-card">
            <div className="calendar-header">
              <div>
                <h2>월간 캘린더</h2>
                <p>운동/휴식/메모를 한눈에 볼 수 있어요.</p>
              </div>
              <div className="calendar-nav">
                <button onClick={goPrevMonth} className="ghost-btn">이전</button>
                <span>{titleLabel}</span>
                <button onClick={goNextMonth} className="ghost-btn">다음</button>
              </div>
            </div>

            {loading && <div className="muted">불러오는 중...</div>}
            {error && <div className="error-text">{error}</div>}

            <div className="calendar-weekdays">
              {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} className="calendar-cell empty" />;
                const log = logMap.get(cell.key);
                const did = log?.didWorkout;
                const memoIcon = log?.memo?.trim() ? "M" : "";
                const mediaIcon = (log?.mediaUrls?.length ?? 0) > 0 ? "P" : "";
                const isToday = cell.key === todayKey;
                const isSelectable = Boolean(log);
                return (
                  <div
                    key={cell.key}
                    className={`calendar-cell ${did ? "done" : log ? "rest" : ""} ${isToday ? "today" : ""} ${
                      isSelectable ? "cursor-pointer" : ""
                    } ${selectedDateKey === cell.key ? "ring-2 ring-orange-300/60" : ""}`}
                    onClick={() => {
                      if (isSelectable) {
                        setSelectedDateKey(cell.key);
                      }
                    }}
                    title={isSelectable ? "기록 조회" : ""}
                  >
                    <div className="calendar-day">{cell.day}</div>
                    <div className="calendar-meta">
                      <span>{did ? "O" : log ? "R" : ""}</span>
                      <span>{memoIcon || mediaIcon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="attendance-side">
            <div className="attendance-card streak-card">
              <div className="streak-header">
                <div>
                  <h3>연속 출석</h3>
                  <p>{currentStreak ? `${currentStreak}일 연속 출석 중` : "다시 시작할 시간"}</p>
                </div>
                <div className={`streak-flame ${currentStreak ? "live" : "off"}`}><span className="flame-core" /></div>
              </div>
              <div className="streak-progress">
                <div className="streak-bar"><div className="streak-fill" style={{ width: `${streakProgress * 100}%` }} /></div>
                <div className="streak-meta"><span>다음 보상: {nextMilestone}일</span><span>이번 달 최고 {bestStreak}일</span></div>
              </div>
            </div>

            <div className="attendance-card summary-card">
              <h3>이번 달 요약</h3>
              <div className="summary-row"><span>운동 출석</span><strong>{summary?.monthWorkoutCount ?? 0}일</strong></div>
              <div className="summary-row"><span>현재 스트릭</span><strong>{currentStreak}일</strong></div>
              <div className="summary-row"><span>최고 스트릭</span><strong>{bestStreak}일</strong></div>
            </div>

            <div className="attendance-card weekly-card">
              <h3>주간 리포트</h3>
              <div className="weekly-grid">
                {weekStats.days.map((day, idx) => (
                  <div key={day.key} className={`weekly-dot ${day.log?.didWorkout ? "active" : ""}`} style={{ animationDelay: `${idx * 0.05}s` }} />
                ))}
              </div>
              <div className="weekly-row"><span>이번 주 출석</span><strong>{weekStats.workoutDays} / 7</strong></div>
              <div className="weekly-row"><span>가장 많이 한 운동</span><strong>{weekStats.mostType ? WORKOUT_TYPES.find((item) => item.id === weekStats.mostType)?.label : "-"}</strong></div>
              <div className="weekly-row"><span>평균 강도</span><strong>{weekStats.avgIntensity ? INTENSITIES[Math.round(weekStats.avgIntensity) - 1]?.label : "-"}</strong></div>
            </div>
            <div className="attendance-card weekly-card">
              <h3>주간 연속출석 랭킹</h3>
              <div className="space-y-2 text-sm">
                {weeklyRank.length === 0 && <p className="text-white/50">기록 없음</p>}
                {weeklyRank.map((item, idx) => (
                  <div key={item.userId} className="flex items-center justify-between">
                    <span>{idx + 1}. {item.nickname}</span>
                    <strong>{item.score}일</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="attendance-card weekly-card">
              <h3>월간 미디어 인증 랭킹</h3>
              <div className="space-y-2 text-sm">
                {mediaRank.length === 0 && <p className="text-white/50">기록 없음</p>}
                {mediaRank.map((item, idx) => (
                  <div key={`m-${item.userId}`} className="flex items-center justify-between">
                    <span>{idx + 1}. {item.nickname}</span>
                    <strong>{item.score}회</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {selectedLog && selectedDateKey && (
          <div className="attendance-card mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">출석 기록 조회</h3>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setSelectedDateKey(null)}
              >
                닫기
              </button>
            </div>
            <div className="text-sm text-white/70">{selectedDateKey}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/20 px-3 py-1">
                상태: {selectedLog.didWorkout ? "운동" : "휴식"}
              </span>
              {selectedLog.workoutIntensity && (
                <span className="rounded-full border border-orange-400/60 px-3 py-1 text-orange-200">
                  강도: {selectedLog.workoutIntensity}
                </span>
              )}
              {(selectedLog.workoutTypes ?? []).map((type) => (
                <span key={type} className="rounded-full border border-white/20 px-3 py-1">
                  {type}
                </span>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/90 whitespace-pre-line">
              {selectedLog.memo?.trim() || "메모 없음"}
            </div>
            {(selectedLog.mediaUrls?.length ?? 0) > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(selectedLog.mediaUrls ?? []).map((rawUrl) => {
                  const url = withBase(rawUrl);
                  return (
                    <div key={rawUrl} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                      {isVideo(url) ? (
                        <video src={url} className="w-full h-24 object-cover" controls />
                      ) : (
                        <img src={url} alt="attendance archive media" className="w-full h-24 object-cover" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="attendance-card action-card">
          <div className="action-header">
            <div>
              <h2>오늘의 운동 체크</h2>
              <p>기록 + 사진/영상까지 남기고 자랑 링크를 만들어보세요.</p>
            </div>
            <div className={`status-pill ${didWorkout ? "active" : "rest"}`}>{didWorkout ? "운동 완료" : "휴식"}</div>
          </div>

          <div className="action-row">
            <div className="toggle-group">
              <button onClick={() => setDidWorkout(true)} className={`toggle-btn ${didWorkout ? "selected" : ""}`}>운동했다</button>
              <button onClick={() => setDidWorkout(false)} className={`toggle-btn ${!didWorkout ? "selected" : ""}`}>쉬었다</button>
            </div>
            {hasTodayLog && <span className="lock-badge">오늘 기록 있음 (수정 가능)</span>}
          </div>

          <div className={`action-grid ${!didWorkout ? "disabled" : ""}`}>
            {WORKOUT_TYPES.map((option) => {
              const active = workoutTypes.includes(option.id);
              return (
                <button key={option.id} onClick={() => toggleWorkoutType(option.id)} className={`workout-chip ${active ? "active" : ""}`} disabled={!didWorkout}>
                  <span className="chip-icon">{option.icon}</span>
                  <span className="chip-text"><strong>{option.label}</strong><small>{option.hint}</small></span>
                </button>
              );
            })}
          </div>

          <div className={`intensity-row ${!didWorkout ? "disabled" : ""}`}>
            {INTENSITIES.map((option) => (
              <button key={option.id} onClick={() => setWorkoutIntensity(option.id)} className={`intensity-chip ${workoutIntensity === option.id ? "active" : ""}`} disabled={!didWorkout}>
                <span className="chip-icon">I</span>
                <span><strong>{option.label}</strong><small>{option.tag}</small></span>
              </button>
            ))}
          </div>

          <div className="memo-block">
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} rows={3} placeholder="오늘 운동 한 줄 요약" />
            <div className="memo-meta">
              <span>{memo.length}/200</span>
              <span className="keyword-tag">보너스 키워드: {keywordMatches.length ? keywordMatches.join(", ") : "-"}</span>
            </div>
          </div>

          <div className="memo-block">
            <textarea value={shareComment} onChange={(e) => setShareComment(e.target.value)} maxLength={280} rows={2} placeholder="공유할 자랑 멘트 (선택)" />
            <div className="memo-meta">
              <span>{shareComment.length}/280</span>
              <div className="flex flex-wrap gap-2">
                {SHARE_COMMENT_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setShareComment(template)}
                    className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/70 hover:border-white/40"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-white/70">사진/영상 첨부 (최대 10개)</p>
            <UploadDropzone
              onUploaded={(url) => setMediaUrls((prev) => (prev.length >= 10 ? prev : [...prev, url]))}
              accept="image/*,video/*"
              multiple
              folder="attendance"
            />
            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {mediaUrls.map((rawUrl) => {
                  const url = withBase(rawUrl);
                  return (
                    <div key={rawUrl} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                      {isVideo(url) ? <video src={url} className="w-full h-24 object-cover" controls /> : <img src={url} alt="attendance media" className="w-full h-24 object-cover" />}
                      <button type="button" onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== rawUrl))} className="w-full text-xs py-1 border-t border-white/10 text-red-300">
                        삭제
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="action-footer">
            <div className="reward-preview">
              <span>예상 EXP</span>
              <strong>{didWorkout ? `+${estimatedExp}` : "+0"}</strong>
              <small>스트릭 + 미디어 보너스 포함</small>
            </div>
            <button onClick={saveToday} disabled={saving} className="primary-btn">
              {saving ? "저장 중..." : hasTodayLog ? "출석 기록 수정 저장" : "출석 기록 저장"}
            </button>
          </div>

          {todayLog && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={quickShare} disabled={sharing} className="rounded-xl border border-emerald-400/60 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10">
                {sharing ? "공유 중..." : "원클릭 자랑하기"}
              </button>
              <button onClick={copyShareLink} disabled={sharing} className="rounded-xl border border-orange-400/60 px-4 py-2 text-sm text-orange-200 hover:bg-orange-500/10">
                {sharing ? "생성 중..." : todayLog.shareSlug ? "자랑 링크 복사" : "자랑 링크 만들기"}
              </button>
              <button onClick={kakaoShare} disabled={sharing} className="rounded-xl border border-yellow-400/60 px-4 py-2 text-sm text-yellow-200 hover:bg-yellow-500/10">
                카카오 공유
              </button>
              <button onClick={saveInstaImage} className="rounded-xl border border-fuchsia-400/60 px-4 py-2 text-sm text-fuchsia-200 hover:bg-fuchsia-500/10">
                인스타용 이미지 저장
              </button>
              {todayLog.shared && (
                <button onClick={unshareToday} disabled={sharing} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-white/40">
                  공유 해제
                </button>
              )}
              {todayLog.shareSlug && (
                <a
                  href={appShareLinkForSlug(todayLog.shareSlug)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-sky-400/60 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/10"
                >
                  자랑 페이지 보기
                </a>
              )}
              <span className="text-xs text-white/60 self-center">응원 {todayLog.cheerCount ?? 0} · 수정 {todayLog.editCount ?? 0}회</span>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          <div>
            <strong>{toast.message}</strong>
            {toast.type === "success" && (toast.expEarned ?? 0) > 0 && <span className="toast-exp">EXP +{toast.expEarned}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
