import { useEffect, useMemo, useState } from "react";

type AttendanceLog = {
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  updatedAt?: string | null;
};

type AttendanceSummary = {
  monthWorkoutCount: number;
  currentStreak: number;
  bestStreakInMonth?: number | null;
};

type Toast = { type: "success" | "error"; message: string };

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

export default function Attendance() {
  const [month, setMonth] = useState(() => new Date());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [didWorkout, setDidWorkout] = useState(false);
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

  useEffect(() => {
    if (!isCurrentMonth) {
      return;
    }
    const todayLog = logs.find((log) => log.date === todayKey);
    setDidWorkout(todayLog?.didWorkout ?? false);
    setMemo(todayLog?.memo ?? "");
  }, [logs, isCurrentMonth, todayKey]);

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

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2200);
  };

  const saveToday = async () => {
    try {
      setSaving(true);
      await api<AttendanceLog>("/api/attendance/today", {
        method: "POST",
        body: JSON.stringify({ didWorkout, memo: memo.trim() || null }),
      });
      showToast({ type: "success", message: "오늘 기록을 저장했어요." });
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

  const titleLabel = `${month.getFullYear()}년 ${String(month.getMonth() + 1).padStart(2, "0")}월`;

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 bg-gradient-to-br from-slate-900 via-slate-950 to-neutral-900 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-teal-300">Workout Attendance</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">출석 체크</h1>
          <p className="text-gray-300">매일의 운동 기록을 달력과 스트릭으로 확인하세요.</p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={goPrevMonth}
            className="px-4 py-2 rounded-full border border-white/20 text-sm hover:border-teal-300/60 transition"
          >
            이전
          </button>
          <div className="text-xl font-semibold tracking-tight">{titleLabel}</div>
          <button
            onClick={goNextMonth}
            className="px-4 py-2 rounded-full border border-white/20 text-sm hover:border-teal-300/60 transition"
          >
            다음
          </button>
        </div>

        {loading && <div className="text-gray-300">불러오는 중...</div>}
        {error && <div className="text-red-400">{error}</div>}

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="grid grid-cols-7 text-xs text-gray-400 mb-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                <div key={label} className="text-center">{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="h-20 rounded-lg bg-white/5 border border-white/5" />;
                }
                const log = logMap.get(cell.key);
                const did = log?.didWorkout;
                const memoIcon = log?.memo?.trim() ? "📝" : "";
                const isToday = cell.key === todayKey;
                return (
                  <div
                    key={cell.key}
                    className={`h-20 rounded-lg border p-2 flex flex-col justify-between ${
                      did
                        ? "bg-emerald-500/20 border-emerald-400/40"
                        : log
                        ? "bg-rose-500/10 border-rose-400/40"
                        : "bg-white/5 border-white/10"
                    } ${isToday ? "ring-1 ring-teal-300/60" : ""}`}
                  >
                    <div className="text-sm font-semibold">{cell.day}</div>
                    <div className="flex items-center justify-between text-sm">
                      <span>{did ? "✓" : ""}</span>
                      <span>{memoIcon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
              <h2 className="text-lg font-semibold">이번 달 요약</h2>
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>운동 횟수</span>
                <span className="text-white font-semibold">{summary?.monthWorkoutCount ?? 0}회</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>현재 스트릭</span>
                <span className="text-white font-semibold">{summary?.currentStreak ?? 0}일</span>
              </div>
              {summary?.bestStreakInMonth !== undefined && (
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>월 최고 스트릭</span>
                  <span className="text-white font-semibold">{summary.bestStreakInMonth ?? 0}일</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
              <h2 className="text-lg font-semibold">오늘 운동 체크</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDidWorkout(true)}
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    didWorkout ? "border-emerald-300 bg-emerald-500/20" : "border-white/20"
                  }`}
                >
                  운동함
                </button>
                <button
                  onClick={() => setDidWorkout(false)}
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    !didWorkout ? "border-rose-300 bg-rose-500/20" : "border-white/20"
                  }`}
                >
                  안함
                </button>
              </div>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={200}
                rows={4}
                placeholder="메모를 남겨주세요 (최대 200자)"
                className="w-full rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              />
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{memo.length}/200</span>
                <button
                  onClick={saveToday}
                  disabled={saving}
                  className="px-5 py-2 rounded-full bg-teal-500 text-black text-sm font-semibold hover:bg-teal-400 transition disabled:opacity-60"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
    </section>
  );
}
