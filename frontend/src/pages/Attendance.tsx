import { useEffect, useMemo, useState } from "react";
import "../styles/attendance.css";

type AttendanceLog = {
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
  expEarned?: number | null;
  updatedAt?: string | null;
};

type AttendanceSummary = {
  monthWorkoutCount: number;
  currentStreak: number;
  bestStreakInMonth?: number | null;
};

type Toast = { type: "success" | "error"; message: string; expEarned?: number | null };

type WorkoutOption = { id: string; label: string; icon: string; hint: string };

type IntensityOption = { id: string; label: string; tag: string; power: number };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const WORKOUT_TYPES: WorkoutOption[] = [
  { id: "weight", label: "웨이트", icon: "🏋️", hint: "근육 펌핑" },
  { id: "cardio", label: "유산소", icon: "🏃", hint: "심폐 폭주" },
  { id: "stretch", label: "스트레칭", icon: "🧘", hint: "회복 모드" },
];

const INTENSITIES: IntensityOption[] = [
  { id: "light", label: "가벼움", tag: "회복", power: 1 },
  { id: "normal", label: "보통", tag: "루틴", power: 2 },
  { id: "hard", label: "빡셈", tag: "폭발", power: 3 },
];

const MEMO_KEYWORDS = ["3대", "갱신", "PR", "데드", "스쿼트"] as const;
const STREAK_MILESTONES = [3, 7, 14, 30];

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
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [didWorkout, setDidWorkout] = useState(true);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [workoutIntensity, setWorkoutIntensity] = useState<string | null>(null);
  const [memo, setMemo] = useState("");

  const monthKey = formatMonthKey(month);
  const todayKey = formatDateKey(new Date());
  const isCurrentMonth = monthKey === formatMonthKey(new Date());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [logsRes, summaryRes] = await Promise.all([
          api<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
          api<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
        ]);
        setLogs(logsRes);
        setSummary(summaryRes);
      } catch (e: any) {
        setError(e?.message || "출석 기록을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, [monthKey]);

  const todayLog = useMemo(() => {
    if (!isCurrentMonth) return null;
    return logs.find((log) => log.date === todayKey) ?? null;
  }, [logs, isCurrentMonth, todayKey]);

  const isLocked = Boolean(todayLog);

  useEffect(() => {
    if (!isCurrentMonth) {
      return;
    }
    if (todayLog) {
      setDidWorkout(todayLog.didWorkout);
      setMemo(todayLog.memo ?? "");
      setWorkoutTypes(todayLog.workoutTypes ?? []);
      setWorkoutIntensity(todayLog.workoutIntensity ?? null);
      return;
    }
    setDidWorkout(true);
    setMemo("");
    setWorkoutTypes([]);
    setWorkoutIntensity(null);
  }, [todayLog, isCurrentMonth]);

  useEffect(() => {
    if (!didWorkout && !isLocked) {
      setWorkoutTypes([]);
      setWorkoutIntensity(null);
    }
  }, [didWorkout, isLocked]);

  const logMap = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    logs.forEach((log) => map.set(log.date, log));
    return map;
  }, [logs]);

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
      return {
        day,
        key: formatDateKey(date),
      };
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
          if (typeCounts[type] !== undefined) {
            typeCounts[type] += 1;
          }
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

    return {
      days,
      workoutDays,
      mostType,
      avgIntensity,
    };
  }, [logMap]);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2200);
  };

  const saveToday = async () => {
    if (isLocked) {
      showToast({ type: "error", message: "오늘 기록은 이미 저장됐어요." });
      return;
    }
    try {
      setSaving(true);
      const res = await api<AttendanceLog>("/api/attendance/today", {
        method: "POST",
        body: JSON.stringify({
          didWorkout,
          memo: memo.trim() || null,
          workoutTypes: didWorkout ? workoutTypes : [],
          workoutIntensity: didWorkout ? workoutIntensity : null,
        }),
      });
      localStorage.setItem("attendanceCompletedAt", todayKey);
      const exp = res.expEarned ?? 0;
      showToast({
        type: "success",
        message: didWorkout ? "오늘의 기록 완료!" : "휴식도 기록했어요.",
        expEarned: exp,
      });
      const [logsRes, summaryRes] = await Promise.all([
        api<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
        api<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
      ]);
      setLogs(logsRes);
      setSummary(summaryRes);
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "저장에 실패했어요." });
    } finally {
      setSaving(false);
    }
  };

  const goPrevMonth = () => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const toggleWorkoutType = (id: string) => {
    if (isLocked || !didWorkout) {
      return;
    }
    setWorkoutTypes((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id].slice(0, 3);
    });
  };

  const keywordMatches = useMemo(() => {
    if (!memo.trim()) {
      return [] as string[];
    }
    return MEMO_KEYWORDS.filter((keyword) => memo.includes(keyword));
  }, [memo]);

  const currentStreak = summary?.currentStreak ?? 0;
  const bestStreak = summary?.bestStreakInMonth ?? 0;
  const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > currentStreak) ?? 30;
  const streakProgress = Math.min(currentStreak / nextMilestone, 1);

  const projectedStreak = isLocked ? currentStreak : currentStreak + (didWorkout ? 1 : 0);
  const estimatedExp = useMemo(() => {
    if (isLocked || !didWorkout) {
      return 0;
    }
    const base = 5;
    const typeBonus = workoutTypes.length;
    const intensityBonus = workoutIntensity
      ? INTENSITIES.find((item) => item.id === workoutIntensity)?.power ?? 0
      : 0;
    const memoBonus = memo.trim() ? 1 : 0;
    const keywordBonus = Math.min(keywordMatches.length, 3);
    return base + typeBonus + intensityBonus + memoBonus + keywordBonus + streakBonus(projectedStreak);
  }, [didWorkout, workoutTypes, workoutIntensity, memo, keywordMatches.length, projectedStreak, isLocked]);

  const titleLabel = `${month.getFullYear()}년 ${String(month.getMonth() + 1).padStart(2, "0")}월`;

  return (
    <section className="attendance-shell">
      <div className="attendance-bg" />
      <div className="attendance-wrap">
        <header className="attendance-hero">
          <p className="attendance-eyebrow">MuscleUp Attendance Engine</p>
          <h1>출석 체크</h1>
          <p>
            하루의 운동 기록이 캐릭터를 성장시키는 엔진이에요. 버튼이 아닌 행동 기록으로, 즉시 보상을
            느껴보세요.
          </p>
        </header>

        <div className="attendance-grid">
          <div className="attendance-card calendar-card">
            <div className="calendar-header">
              <div>
                <h2>월간 캘린더</h2>
                <p>출석은 체크 아이콘으로, 오늘은 가장 선명하게 보여요.</p>
              </div>
              <div className="calendar-nav">
                <button onClick={goPrevMonth} className="ghost-btn">
                  이전
                </button>
                <span>{titleLabel}</span>
                <button onClick={goNextMonth} className="ghost-btn">
                  다음
                </button>
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
                if (!cell) {
                  return <div key={`empty-${idx}`} className="calendar-cell empty" />;
                }
                const log = logMap.get(cell.key);
                const did = log?.didWorkout;
                const memoIcon = log?.memo?.trim() ? "✍️" : "";
                const isToday = cell.key === todayKey;
                return (
                  <div
                    key={cell.key}
                    className={`calendar-cell ${
                      did ? "done" : log ? "rest" : ""
                    } ${isToday ? "today" : ""}`}
                  >
                    <div className="calendar-day">{cell.day}</div>
                    <div className="calendar-meta">
                      <span>{did ? "✅" : log ? "🫧" : ""}</span>
                      <span>{memoIcon}</span>
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
                  <p>{currentStreak ? `🔥 ${currentStreak}일 연속 출석 중!` : "다시 시작할 시간!"}</p>
                </div>
                <div className={`streak-flame ${currentStreak ? "live" : "off"}`}>
                  <span className="flame-core" />
                </div>
              </div>
              <div className="streak-progress">
                <div className="streak-bar">
                  <div className="streak-fill" style={{ width: `${streakProgress * 100}%` }} />
                </div>
                <div className="streak-meta">
                  <span>다음 보상: {nextMilestone}일</span>
                  <span>이번 달 최고 {bestStreak}일</span>
                </div>
              </div>
              <div className="streak-tiers">
                {[3, 3, 3].map((tier, idx) => (
                  <div key={`${tier}-${idx}`} className={`tier-chip ${currentStreak >= tier ? "active" : ""}`}>
                    {tier}일 {idx === 0 ? "얼굴 커스텀" : idx === 1 ? "몸통 커스텀" : "엠블럼 커스텀"}
                  </div>
                ))}
              </div>
            </div>

            <div className="attendance-card summary-card">
              <h3>이번 달 요약</h3>
              <div className="summary-row">
                <span>운동 출석</span>
                <strong>{summary?.monthWorkoutCount ?? 0}일</strong>
              </div>
              <div className="summary-row">
                <span>현재 스트릭</span>
                <strong>{currentStreak}일</strong>
              </div>
              <div className="summary-row">
                <span>최고 스트릭</span>
                <strong>{bestStreak}일</strong>
              </div>
            </div>

            <div className="attendance-card weekly-card">
              <h3>주간 리포트</h3>
              <div className="weekly-grid">
                {weekStats.days.map((day, idx) => (
                  <div
                    key={day.key}
                    className={`weekly-dot ${day.log?.didWorkout ? "active" : ""}`}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  />
                ))}
              </div>
              <div className="weekly-row">
                <span>이번 주 출석</span>
                <strong>{weekStats.workoutDays} / 7</strong>
              </div>
              <div className="weekly-row">
                <span>가장 많이 한 운동</span>
                <strong>
                  {weekStats.mostType
                    ? WORKOUT_TYPES.find((item) => item.id === weekStats.mostType)?.label
                    : "-"}
                </strong>
              </div>
              <div className="weekly-row">
                <span>평균 강도</span>
                <strong>
                  {weekStats.avgIntensity
                    ? INTENSITIES[Math.round(weekStats.avgIntensity) - 1]?.label
                    : "-"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="attendance-card action-card">
          <div className="action-header">
            <div>
              <h2>오늘의 운동 체크</h2>
              <p>아이콘만 눌러도 기록이 끝나요. 10초면 충분합니다.</p>
            </div>
            <div className={`status-pill ${didWorkout ? "active" : "rest"}`}>
              {didWorkout ? "운동 완료" : "휴식"}
            </div>
          </div>

          <div className="action-row">
            <div className="toggle-group">
              <button
                onClick={() => setDidWorkout(true)}
                className={`toggle-btn ${didWorkout ? "selected" : ""}`}
                disabled={isLocked}
              >
                💪 운동했다
              </button>
              <button
                onClick={() => setDidWorkout(false)}
                className={`toggle-btn ${!didWorkout ? "selected" : ""}`}
                disabled={isLocked}
              >
                🌙 쉬었다
              </button>
            </div>
            {isLocked && <span className="lock-badge">오늘 기록 완료</span>}
          </div>

          <div className={`action-grid ${!didWorkout ? "disabled" : ""}`}>
            {WORKOUT_TYPES.map((option) => {
              const active = workoutTypes.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleWorkoutType(option.id)}
                  className={`workout-chip ${active ? "active" : ""}`}
                  disabled={isLocked || !didWorkout}
                >
                  <span className="chip-icon">{option.icon}</span>
                  <span className="chip-text">
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`intensity-row ${!didWorkout ? "disabled" : ""}`}>
            {INTENSITIES.map((option) => (
              <button
                key={option.id}
                onClick={() => setWorkoutIntensity(option.id)}
                className={`intensity-chip ${workoutIntensity === option.id ? "active" : ""}`}
                disabled={isLocked || !didWorkout}
              >
                <span className="chip-icon">⚡</span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.tag}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="memo-block">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="오늘 운동 한 줄 요약"
              disabled={isLocked}
            />
            <div className="memo-meta">
              <span>{memo.length}/200</span>
              <span className="keyword-tag">
                보너스 키워드: {keywordMatches.length ? keywordMatches.join(", ") : "-"}
              </span>
            </div>
          </div>

          <div className="action-footer">
            <div className="reward-preview">
              <span>예상 EXP</span>
              <strong>{didWorkout ? `+${estimatedExp}` : "+0"}</strong>
              <small>스트릭 보너스 포함</small>
            </div>
            <button onClick={saveToday} disabled={saving || isLocked} className="primary-btn">
              {saving ? "저장 중..." : "출석 기록 저장"}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          <div>
            <strong>{toast.message}</strong>
            {toast.type === "success" && (toast.expEarned ?? 0) > 0 && (
              <span className="toast-exp">EXP +{toast.expEarned}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
