import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { GrowthParams } from "../components/avatar/types";
import "../styles/homeLobby.css";
import { logEvent } from "../utils/analytics";
import { eventApi } from "../services/eventApi";
import type { EventItem } from "../types/event";

type AttendanceLog = {
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
};

type AttendanceSummary = {
  monthWorkoutCount: number;
  currentStreak: number;
  bestStreakInMonth?: number | null;
};

type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

type CharacterProfile = {
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  title?: string;
  avatarSeed: string;
  stylePreset: string;
  growthParams?: GrowthParams | null;
};

type StatsResponse = {
  gender?: "MALE" | "FEMALE";
  mbti?: string | null;
};

type LocalUser = {
  email?: string;
  nickname?: string;
};

type LobbyMetrics = {
  loungeVisitCount: number;
  todayAttendanceCount: number;
  totalThreeLiftKg: number;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";

const ACTIONS = [
  {
    id: "attendance",
    label: "출석 체크하기",
    desc: "오늘의 첫 퀘스트",
    icon: "🔥",
    to: "/attendance",
  },
  {
    id: "lounge",
    label: "라운지 입장하기",
    desc: "지금 함께 운동",
    icon: "🏋️",
    to: "/lounge",
  },
  {
    id: "character",
    label: "내 캐릭터 보기",
    desc: "성장 결과 확인",
    icon: "📈",
    to: "/mypage",
  },
  {
    id: "crew",
    label: "운동 모임 가기",
    desc: "팀 출석률 확인",
    icon: "👥",
    to: "/crew",
  },
];

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

async function safeFetchJson<T>(path: string): Promise<T | null> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function Home() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [mbti, setMbti] = useState<string | null>(null);
  const [loungeCount, setLoungeCount] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<LobbyMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReaction, setShowReaction] = useState(false);
  const [activeEvents, setActiveEvents] = useState<EventItem[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [isEventPaused, setIsEventPaused] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  const monthKey = formatMonthKey(new Date());
  const todayKey = formatDateKey(new Date());

  const loadLobbyData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [logsRes, summaryRes, characterRes, statsRes] = await Promise.all([
        safeFetchJson<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
        safeFetchJson<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
        safeFetchJson<CharacterProfile>("/api/character/me"),
        safeFetchJson<StatsResponse>("/api/mypage/stats"),
      ]);
      if (logsRes) setLogs(logsRes);
      if (summaryRes) setSummary(summaryRes);
      if (characterRes) setCharacter(characterRes);
      setMbti(statsRes?.mbti ?? null);
    } catch (err: any) {
      setError(err?.message ?? "로비 정보를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [monthKey, user]);

  const loadLoungeStatus = useCallback(async () => {
    try {
      const res = await fetch(`${REALTIME_URL}/status`, { credentials: "omit" });
      if (!res.ok) throw new Error("status failed");
      const payload = await res.json();
      const count = Number(payload?.activePlayers);
      if (Number.isFinite(count)) {
        setLoungeCount(count);
        return;
      }
      throw new Error("invalid count");
    } catch {
      setLoungeCount(null);
    }
  }, []);

  const loadLobbyMetrics = useCallback(async () => {
    try {
      const url = API_BASE ? `${API_BASE}/api/metrics/lobby` : "/api/metrics/lobby";
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error("metrics failed");
      const payload = (await res.json()) as LobbyMetrics;
      setMetrics(payload);
    } catch {
      setMetrics(null);
    }
  }, []);

  const loadActiveEvents = useCallback(async () => {
    try {
      const res = await eventApi.getPublicList({ status: "ACTIVE", page: 0, size: 10 });
      setActiveEvents(res.content ?? []);
      setEventIndex(0);
    } catch {
      setActiveEvents([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadLobbyData();
  }, [loadLobbyData, user]);

  useEffect(() => {
    loadLoungeStatus();
    const interval = window.setInterval(() => {
      loadLoungeStatus();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadLoungeStatus]);

  useEffect(() => {
    loadLobbyMetrics();
    const interval = window.setInterval(() => {
      loadLobbyMetrics();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadLobbyMetrics]);

  useEffect(() => {
    loadActiveEvents();
  }, [loadActiveEvents]);

  useEffect(() => {
    const handleFocus = () => {
      if (user) loadLobbyData();
      loadLobbyMetrics();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [loadLobbyData, user]);

  useEffect(() => {
    logEvent("home", "page_view");
  }, []);

  useEffect(() => {
    if (activeEvents.length <= 1) return;
    if (isEventPaused) return;
    const interval = window.setInterval(() => {
      setEventIndex((prev) => (prev + 1) % activeEvents.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [activeEvents.length, isEventPaused]);

  const logMap = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    logs.forEach((log) => map.set(log.date, log));
    return map;
  }, [logs]);

  const todayLog = useMemo(() => logMap.get(todayKey), [logMap, todayKey]);
  const isAttendanceDone = Boolean(todayLog);
  const todayLabel = todayLog
    ? todayLog.didWorkout
      ? "운동 기록 완료"
      : "휴식 기록 완료"
    : "아직 기록 없음";

  const weekStats = useMemo(() => {
    const start = startOfWeek(new Date());
    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const key = formatDateKey(date);
      return { key, log: logMap.get(key) };
    });
    const workoutDays = days.filter((day) => day.log?.didWorkout).length;
    return { days, workoutDays };
  }, [logMap]);

  useEffect(() => {
    const completedAt = localStorage.getItem("attendanceCompletedAt");
    if (completedAt === todayKey && isAttendanceDone) {
      setShowReaction(true);
      localStorage.removeItem("attendanceCompletedAt");
      const timer = window.setTimeout(() => setShowReaction(false), 2400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isAttendanceDone, todayKey]);

  const loungeCountLabel = loungeCount !== null ? loungeCount : "--";

  const formatNumber = (value?: number | null) => {
    if (value === null || value === undefined) return "--";
    return Math.round(value).toLocaleString("ko-KR");
  };

  const totalThreeLiftLabel = metrics
    ? `${formatNumber(metrics.totalThreeLiftKg)}kg`
    : "--";

  const heroStats = [
    { label: "라운지 누적 입장", value: formatNumber(metrics?.loungeVisitCount) },
    { label: "오늘 기록된 출석", value: formatNumber(metrics?.todayAttendanceCount) },
    { label: "모두의 3대 합", value: totalThreeLiftLabel },
  ];

  return (
    <section className="home-lobby">
      <div className="home-lobby-bg" />
      <div className="home-lobby-wrap">
        <header className="hero">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="pulse-dot" />
              게임형 피트니스 로비
            </div>
            <h1>
              <span className="hero-line brand">득근득근</span>
              <span className="hero-line strong-copy">오늘의 땀으로 성장 폭발</span>
              <span className="hero-line highlight">서로를 키우는 커뮤니티</span>
            </h1>
            <p>
              출석 체크가 오늘의 첫 퀘스트가 되고, 캐릭터가 나의 성장을 보여주는 곳.
              지금 바로 로비에서 시작하세요.
            </p>
            <div className="hero-actions">
              <Link to="/attendance" className="cta primary">
                오늘 출석 시작
              </Link>
              <Link to="/lounge" className="cta ghost">
                라운지 둘러보기
              </Link>
            </div>
            <div className="hero-stats">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

        </header>

        {activeEvents.length > 0 && (
          <section className="event-banner">
            <div className="event-banner-head">
              <span className="eyebrow">진행 중 이벤트</span>
              <Link to="/events" className="mini-link">
                전체 이벤트 보기 →
              </Link>
            </div>
            <div
              className="event-slider"
              onMouseEnter={() => setIsEventPaused(true)}
              onMouseLeave={() => setIsEventPaused(false)}
            >
              <div
                className="event-track"
                style={{ transform: `translateX(-${eventIndex * 100}%)` }}
              >
                {activeEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="event-banner-card"
                  >
                    <img src={event.thumbnailUrl} alt={event.title} />
                    <div className="event-banner-body">
                      <strong>{event.title}</strong>
                      <p>{event.summary}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            {activeEvents.length > 1 && (
              <div className="event-dots">
                {activeEvents.map((event, idx) => (
                  <button
                    key={event.id}
                    type="button"
                    className={idx === eventIndex ? "active" : ""}
                    onClick={() => setEventIndex(idx)}
                    aria-label={`${idx + 1}번 이벤트 보기`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="lobby-grid">
          <div className="action-preview">
            <div className="hero-orbit">
              <div className="orbit-ring" />
              <div className="orbit-ring ring-2" />
              <div className={`action-hub ${showReaction ? "reacted" : ""}`}>
                <div className="action-header">
                  <div>
                    <span className="eyebrow">오늘의 액션</span>
                    <h2>지금 해야 할 일</h2>
                  </div>
                  <div className={`attendance-status ${isAttendanceDone ? "done" : "pending"}`}>
                    {todayLabel}
                  </div>
                </div>

                <div className="action-list">
                  {ACTIONS.map((action) => {
                    const isAttendance = action.id === "attendance";
                    return (
                      <Link
                        key={action.id}
                        to={action.to}
                        className={`action-btn ${isAttendance && !isAttendanceDone ? "urgent" : ""} ${
                          isAttendance && isAttendanceDone ? "complete" : ""
                        } ${isAttendance && showReaction ? "burst" : ""}`}
                      >
                        <span className="action-icon">{action.icon}</span>
                        <span>
                          <strong>{isAttendance && isAttendanceDone ? "오늘 완료!" : action.label}</strong>
                          <small>{action.desc}</small>
                        </span>
                        {isAttendance && isAttendanceDone && <span className="check">✓</span>}
                      </Link>
                    );
                  })}
                </div>

                <div className="action-stats">
                  <div>
                    <span>연속 출석</span>
                    <strong>{summary?.currentStreak ?? 0}일</strong>
                  </div>
                  <div>
                    <span>오늘 상태</span>
                    <strong>{todayLog ? "완료" : "대기"}</strong>
                  </div>
                  <div>
                    <span>이번 주</span>
                    <strong>{weekStats.workoutDays}/7</strong>
                  </div>
                </div>

                {loading && <div className="hub-note">로딩 중...</div>}
                {error && <div className="hub-error">{error}</div>}
                {!user && <div className="hub-note">로그인하면 로비 상태가 연동됩니다.</div>}
              </div>
            </div>
          </div>
          <div className="character-preview">
            <div className="card-header">
              <div>
                <span className="eyebrow">내 캐릭터</span>
                <h3>캐릭터 미리보기</h3>
              </div>
              <Link to="/mypage" className="mini-link">
                성장 기록 보기 →
              </Link>
            </div>
            <div className="character-stage">
              {character ? (
                <div className={`avatar-shell ${showReaction ? "reacted" : ""}`}>
                  <AvatarRenderer
                    avatarSeed={character.avatarSeed}
                    growthParams={character.growthParams}
                    tier={character.tier}
                    stage={character.evolutionStage}
                    mbti={mbti}
                    size={180}
                  />
                </div>
              ) : (
                <div className="avatar-placeholder">
                  <span>로그인 후 캐릭터가 표시됩니다</span>
                </div>
              )}
              <div className="character-meta">
                <strong>{character ? `${character.tier} · Stage ${character.evolutionStage}` : "캐릭터 준비 중"}</strong>
                <p>{character ? `Lv.${character.level} ${character.title ?? ""}` : "출석과 운동 기록이 캐릭터를 키웁니다."}</p>
              </div>
            </div>
            <div className="character-reward">
              <span>출석 완료 시 캐릭터가 리액션합니다</span>
              <div className="reaction-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="lounge-preview">
            <div className="card-header">
              <div>
                <span className="eyebrow">소셜 라운지</span>
                <h3>라운지 미리보기</h3>
              </div>
              <Link to="/lounge" className="mini-link">
                라운지 입장 →
              </Link>
            </div>
            <div className="lounge-canvas">
              <div className="lounge-avatars">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <span key={`avatar-${idx}`} className={`lounge-dot dot-${idx + 1}`} />
                ))}
              </div>
              <div className="lounge-info">
                <strong>🔥 지금 라운지에 {loungeCountLabel}명이 운동 중</strong>
                <p>캐릭터들이 움직이며 함께 운동하는 공간입니다.</p>
              </div>
            </div>
            <div className="lounge-actions">
              <Link to="/lounge" className="cta primary">
                라운지 입장하기 →
              </Link>
              <div className="lounge-meta">
                <span>실시간 채팅 · 협력 이벤트</span>
                <span>접속 즉시 동기화</span>
              </div>
            </div>
          </div>
        </div>

        <div className="quest-strip">
          <div>
            <span className="eyebrow">출석 → 성장 → 라운지</span>
            <h3>오늘의 루프가 게임이 됩니다</h3>
            <p>
              출석을 완료하면 캐릭터가 즉시 반응하고, 라운지에서 다른 유저들과
              실시간으로 연결됩니다.
            </p>
          </div>
          <div className="quest-icons">
            <div>
              <span>✅</span>
              <p>출석 체크</p>
            </div>
            <div>
              <span>⚡</span>
              <p>캐릭터 성장</p>
            </div>
            <div>
              <span>🧭</span>
              <p>라운지 진입</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
