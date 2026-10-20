import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import { bodyStageFor, spriteShapeOf } from "../components/avatar/spriteShape";
import BodyStageUp from "../components/avatar/BodyStageUp";
import { toneForMbti } from "../components/gymMap/engine";
import CountUp from "../components/gym/CountUp";
import GymMap from "../components/gymMap/GymMap";
import type { GrowthParams } from "../components/avatar/types";
import "../styles/homeLobby.css";
import { logEvent } from "../utils/analytics";
import { eventApi } from "../services/eventApi";
import { REALTIME_URL } from "../lib/realtime";
import { useCurrentGym, useMyGyms } from "../lib/currentGym";
import type { EventItem } from "../types/event";
import { WEEKLY_GOAL_PATH, type WeeklyGoalStatus } from "../lib/weeklyGoal";
import { SHADOW_PATH, type ShadowStatus } from "../lib/shadow";
import ShadowHomeRow from "../components/boss/ShadowHomeRow";
import { QUEST_LINKS, QUESTS_PATH, type TodayQuests } from "../lib/quests";
import { COLLECTION_SUMMARY_PATH, syncEquippedTank, type CollectionSummary } from "../lib/collection";

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
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
  growthParams?: GrowthParams | null;
  /** 운동 직후 펌핑이 끝나는 시각(ms) · 장착한 민소매 색 */
  pumpedUntil?: number | null;
  tank?: string | null;
  /** 몸 단계 0~5(서버 BodyStage) */
  bodyStage?: number | null;
};
type StatsResponse = { mbti?: string | null };

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

const ACTIONS = [
  {
    id: "attendance",
    label: "출석 체크하기",
    desc: "오늘의 첫 퀘스트",
    to: "/attendance",
  },
  {
    id: "lounge",
    label: "라운지 입장하기",
    desc: "지금 함께 운동",
    to: "/lounge",
  },
  {
    id: "character",
    label: "내 캐릭터 보기",
    desc: "성장 결과 확인",
    to: "/mypage",
  },
  {
    id: "crew",
    label: "운동 모임 가기",
    desc: "팀 출석률 확인",
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
  const request = () =>
    fetch(url, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

  const parseErrorMessage = async (res: Response) => {
    const raw = await res.text().catch(() => "");
    if (!raw) return `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: string };
      return parsed.message || parsed.error || `HTTP ${res.status}`;
    } catch {
      return raw;
    }
  };

  let res = await request();

  if (res.status === 401 || res.status === 403) {
    const refreshUrl = API_BASE ? `${API_BASE}/api/auth/refresh` : "/api/auth/refresh";
    const refreshed = await fetch(refreshUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);

    if (refreshed?.ok) {
      res = await request();
    }
  }

  if (res.status === 401 || res.status === 403) {
    return null;
  }

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(message);
  }

  return res.json();
}

export default function Home() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalStatus | null>(null);
  const [shadow, setShadow] = useState<ShadowStatus | null>(null);
  const [quests, setQuests] = useState<TodayQuests | null>(null);
  const [collection, setCollection] = useState<CollectionSummary | null>(null);
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
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileOverview, setShowMobileOverview] = useState(false);
  const [showMobileCommunity, setShowMobileCommunity] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  const monthKey = formatMonthKey(new Date());
  const todayKey = formatDateKey(new Date());

  const loadLobbyData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [logsRes, summaryRes, characterRes, statsRes, weeklyGoalRes, questsRes, collectionRes, shadowRes] = await Promise.all([
        safeFetchJson<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
        safeFetchJson<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
        safeFetchJson<CharacterProfile>("/api/character/me"),
        safeFetchJson<StatsResponse>("/api/mypage/stats"),
        // 주간 목표는 없어도 홈이 떠야 해서 실패를 삼킨다
        safeFetchJson<WeeklyGoalStatus>(WEEKLY_GOAL_PATH).catch(() => null),
        safeFetchJson<TodayQuests>(QUESTS_PATH).catch(() => null),
        safeFetchJson<CollectionSummary>(COLLECTION_SUMMARY_PATH).catch(() => null),
        safeFetchJson<ShadowStatus>(SHADOW_PATH).catch(() => null),
      ]);
      if (logsRes) setLogs(logsRes);
      if (summaryRes) setSummary(summaryRes);
      setWeeklyGoal(weeklyGoalRes);
      setShadow(shadowRes);
      setQuests(questsRes);
      if (characterRes) setCharacter(characterRes);
      setCollection(collectionRes);
      // 도감에서 장착한 민소매 색을 이 기기의 내 아바타에
      if (characterRes && collectionRes) syncEquippedTank(characterRes.avatarSeed, collectionRes.equipped.tank);
      setMbti(statsRes?.mbti ?? null);
    } catch (err: any) {
      const message = String(err?.message ?? "");
      if (message.includes("Forbidden") || message.includes("Unauthorized") || message.includes("HTTP 401") || message.includes("HTTP 403")) {
        setError("로그인 세션을 다시 확인하는 중입니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError("로비 정보를 불러오지 못했어요.");
      }
    } finally {
      setLoading(false);
    }
  }, [monthKey, user]);

  // 라운지 인원도 헤더에서 고른 모임 방 기준(라운지를 쓰는 내 모임이면 그 방, 아니면 광장)
  const [roomGymSlug] = useCurrentGym();
  const { gyms: myGymsForRoom } = useMyGyms();
  const roomGym = myGymsForRoom.find(
    (g) => g.slug === roomGymSlug && g.status === "ACTIVE" && g.features.includes("LOUNGE"),
  );
  const loungeRoomKey = roomGym ? `gym:${roomGym.id}` : "square";

  const loadLoungeStatus = useCallback(async () => {
    if (!REALTIME_URL) {
      setLoungeCount(null); // 배포에 실시간 서버 주소가 없으면 인원 수를 숨긴다
      return;
    }
    try {
      const res = await fetch(`${REALTIME_URL}/status?room=${encodeURIComponent(loungeRoomKey)}`, { credentials: "omit" });
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
  }, [loungeRoomKey]);

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

  // 홈의 진행 중 소식도 헤더에서 고른 모임(없으면 광장) 기준
  const [currentGymSlug] = useCurrentGym();

  const loadActiveEvents = useCallback(async () => {
    try {
      const res = await eventApi.getPublicList({ gym: currentGymSlug, status: "ACTIVE", page: 0, size: 10 });
      setActiveEvents(res.content ?? []);
      setEventIndex(0);
    } catch {
      setActiveEvents([]);
    }
  }, [currentGymSlug]);

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
  // 지도 위 작은 내 캐릭터 모양(카드 그림과 같은 머리 · 성별 · 몸 단계 · 머리띠)
  const mapShape = useMemo(
    () => (character ? spriteShapeOf({ ...character, pumped: (character.pumpedUntil ?? 0) > Date.now() }, character.tank ?? toneForMbti(mbti).tank) : null),
    [character, mbti],
  );
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

  const heroStats = [
    { label: "라운지 누적 입장", value: metrics?.loungeVisitCount, unit: "" },
    { label: "오늘 기록된 출석", value: metrics?.todayAttendanceCount, unit: "" },
    { label: "모두의 3대 합", value: metrics?.totalThreeLiftKg, unit: "KG" },
  ];

  const visibleActions = useMemo(() => {
    if (!isMobile) return ACTIONS;
    return ACTIONS.filter((action) => action.id === "attendance" || action.id === "crew");
  }, [isMobile]);

  const renderCharacterPreviewCard = (className = "") => (
    <div className={`character-preview dg-steel dg-lift ${className}`.trim()}>
      <div className="card-header">
        <h3>캐릭터 미리보기</h3>
        <Link to="/mypage" className="mini-link">
          성장 기록 보기
        </Link>
      </div>
      <div className="character-stage dg-rubber">
        {character ? (
          <div className={`avatar-shell ${showReaction ? "reacted" : ""}`}>
            <AvatarRenderer
              avatarSeed={character.avatarSeed}
              growthParams={character.growthParams}
              bodyStage={character.bodyStage}
              tier={character.tier}
              stage={character.evolutionStage}
              gender={character.gender}
              mbti={mbti}
              isResting={character.isResting ?? false}
              pumped={(character.pumpedUntil ?? 0) > Date.now()}
              tank={character.tank}
              size={170}
            />
          </div>
        ) : (
          <div className="avatar-placeholder">
            <span>로그인하면 내 캐릭터가 여기 섭니다</span>
          </div>
        )}
        <div className="stage-floor dg-platform" />
      </div>
      <div className="character-meta">
        {character ? (
          <>
            <div className="chip-row">
              <span className="dg-chip chip-tier">{character.tier}</span>
              <span className="dg-chip chip-steel">STAGE {character.evolutionStage}</span>
            </div>
            <strong>{character.title || "이름 없는 리프터"}</strong>
            <p className="font-num">LV {character.level}</p>
          </>
        ) : (
          <>
            <strong>캐릭터 준비 중</strong>
            <p>출석과 운동 기록이 캐릭터를 키웁니다.</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <section className="home-lobby">
      <div className="home-lobby-wrap">
        <header className="hero dg-steel">
          <div className="hero-text">
            <h1>
              <span className="hero-line">오늘의 땀으로</span>
              <span className="hero-line accent">성장 폭발</span>
            </h1>
            <p className="hero-desc">
              출석 체크가 오늘의 첫 퀘스트가 되고, 캐릭터가 나의 성장을 보여주는 곳.
              헬스장을 걸어 다니며 기구 앞에 서 보세요. 운동한 날마다 파워랙 바벨에 원판이 한 장씩 꽂힙니다.
            </p>
            <div className="hero-actions">
              <Link to="/attendance" className="dg-btn dg-btn-primary">
                오늘 출석 시작
              </Link>
              <Link to="/crew" className="dg-btn dg-btn-steel">
                운동 모임 가기
              </Link>
            </div>
            <div className={`hero-stats ${isMobile && !showMobileOverview ? "mobile-collapsed" : ""}`}>
              {heroStats.map((stat) => (
                <div key={stat.label} className="dg-well">
                  <strong className="font-num">
                    <CountUp value={stat.value === undefined ? null : Math.round(stat.value)} />
                    {stat.unit && stat.value !== undefined && <small className="unit">{stat.unit}</small>}
                  </strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-map dg-rubber">
            {character && (
              // 몸 단계가 지난번 본 값보다 오르면 "몸이 커졌어요"(펌핑은 빼고)
              <BodyStageUp
                key={character.avatarSeed}
                seedKey={character.avatarSeed}
                stage={bodyStageFor({ ...character, pumped: false })}
                renderAvatar={(b, size) => (
                  <AvatarRenderer
                    avatarSeed={character.avatarSeed}
                    growthParams={character.growthParams}
                    bodyStage={b}
                    tier={character.tier}
                    stage={character.evolutionStage}
                    gender={character.gender}
                    mbti={mbti}
                    tank={character.tank}
                    size={size}
                  />
                )}
              />
            )}
            <GymMap
              loggedIn={Boolean(user)}
              level={character?.level}
              tier={character?.tier}
              title={character?.title}
              avatar={
                character ? (
                  <AvatarRenderer
                    avatarSeed={character.avatarSeed}
                    growthParams={character.growthParams}
                    bodyStage={character.bodyStage}
                    tier={character.tier}
                    stage={character.evolutionStage}
                    gender={character.gender}
                    mbti={mbti}
                    isResting={character.isResting ?? false}
                    pumped={(character.pumpedUntil ?? 0) > Date.now()}
                    tank={character.tank}
                    size={96}
                  />
                ) : undefined
              }
              mbti={mbti}
              tank={character?.tank ?? null}
              shape={mapShape}
              weekDays={weekStats.workoutDays}
              streak={summary?.currentStreak ?? 0}
              monthCount={summary?.monthWorkoutCount}
              checkedToday={isAttendanceDone}
              todayLabel={todayLabel}
              loungeCount={loungeCount}
              events={activeEvents}
              celebrate={showReaction}
            />
          </div>
        </header>

        {isMobile && (
          <div className="mobile-toggle-strip">
            <button
              type="button"
              className="mobile-toggle-btn"
              aria-expanded={showMobileOverview}
              onClick={() => setShowMobileOverview((prev) => !prev)}
            >
              {showMobileOverview ? "오늘 요약 접기" : "오늘 요약 펼치기"}
            </button>
            <button
              type="button"
              className="mobile-toggle-btn"
              aria-expanded={showMobileCommunity}
              onClick={() => setShowMobileCommunity((prev) => !prev)}
            >
              {showMobileCommunity ? "커뮤니티 접기" : "커뮤니티 펼치기"}
            </button>
          </div>
        )}

        {activeEvents.length > 0 && (!isMobile || showMobileOverview) && (
          <section className="event-banner dg-steel">
            <div className="event-banner-head">
              <h3>진행 중 이벤트</h3>
              <Link to="/events" className="mini-link">
                전체 이벤트 보기
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
          <div className={`action-hub dg-whiteboard ${showReaction ? "reacted" : ""}`}>
            <div className="action-header">
              <h2>지금 해야 할 일</h2>
              <span className={`attendance-status ${isAttendanceDone ? "done" : "pending"}`}>{todayLabel}</span>
            </div>

            {/* 로그인했으면 오늘 할 일 3개(서버 기준), 아니면 예전 바로 가기 */}
            {quests ? (
              <>
                <div className="action-list">
                  {quests.items.map((item, index) => {
                    const link = QUEST_LINKS[item.id];
                    const urgent = !item.done && index === quests.items.findIndex((q) => !q.done);
                    return (
                      <Link
                        key={item.id}
                        to={link.to}
                        className={`action-btn ${urgent ? "urgent" : ""} ${item.done ? "complete" : ""} ${
                          item.id === "attendance" && showReaction ? "burst" : ""
                        } dg-rise`}
                        style={{ animationDelay: `${120 + index * 70}ms` }}
                      >
                        <span className={`action-box ${item.done ? "dg-pop" : ""}`} aria-hidden="true">
                          {item.done && (
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 13l5 5L21 5" />
                            </svg>
                          )}
                        </span>
                        <span className="action-text">
                          <strong>{item.done ? link.doneLabel : item.label}</strong>
                          <small>
                            {link.desc}
                            {item.points > 0 && ` · +${item.points}`}
                          </small>
                        </span>
                        <span className="action-arrow" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <p className={`quest-bonus ${quests.allDone ? "done" : ""}`}>
                  {quests.allDone ? `오늘 할 일 완료! 보너스 +${quests.allPoints}` : `세 개 다 하면 보너스 +${quests.allPoints}`}
                  {quests.protein.goalG != null && (
                    <span>
                      {" · "}단백질 {Math.round(quests.protein.eatenG)}/{quests.protein.goalG}g
                      {quests.protein.done ? ` 달성 +${quests.protein.points}` : ""}
                    </span>
                  )}
                </p>
                <div className="activity-level" aria-label={`활동 레벨 ${quests.activity.level}, 다음 레벨까지 ${quests.activity.pointsForNext - quests.activity.pointsInLevel}점`}>
                  <span className="activity-lv">
                    활동 <span className="font-num">Lv.{quests.activity.level}</span>
                  </span>
                  <span className="activity-track" aria-hidden="true">
                    <i style={{ width: `${Math.round((quests.activity.pointsInLevel / quests.activity.pointsForNext) * 100)}%` }} />
                  </span>
                  <span className="activity-next font-num">
                    {quests.activity.pointsInLevel}/{quests.activity.pointsForNext}
                  </span>
                </div>
                {collection && collection.boxes > 0 && (
                  <Link to="/collection" className="reward-box-link dg-rise">
                    <span className="reward-box-mini" aria-hidden="true" />
                    <span>
                      열지 않은 보상 상자 <strong className="font-num">{collection.boxes}</strong>개
                    </span>
                    <span className="reward-box-go">열기</span>
                  </Link>
                )}
              </>
            ) : (
              <div className="action-list">
                {visibleActions.map((action, index) => {
                  const isAttendance = action.id === "attendance";
                  const done = isAttendance && isAttendanceDone;
                  return (
                    <Link
                      key={action.id}
                      to={action.to}
                      className={`action-btn ${isAttendance && !isAttendanceDone ? "urgent" : ""} ${
                        done ? "complete" : ""
                      } ${isAttendance && showReaction ? "burst" : ""} dg-rise`}
                      style={{ animationDelay: `${120 + index * 70}ms` }}
                    >
                      <span className={`action-box ${done ? "dg-pop" : ""}`} aria-hidden="true">
                        {done && (
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 13l5 5L21 5" />
                          </svg>
                        )}
                      </span>
                      <span className="action-text">
                        <strong>{done ? "오늘 출석 완료" : action.label}</strong>
                        <small>{action.desc}</small>
                      </span>
                      <span className="action-arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

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
                <span>주간 목표</span>
                <strong>
                  {weeklyGoal ? `${weeklyGoal.done}/${weeklyGoal.target}` : `${weekStats.workoutDays}/7`}
                  {weeklyGoal && weeklyGoal.streakWeeks > 0 && <small className="mt-1 block text-base">{weeklyGoal.streakWeeks}주 연속</small>}
                </strong>
              </div>
            </div>

            <ShadowHomeRow status={shadow} />

            {loading && <div className="hub-note">불러오는 중...</div>}
            {error && <div className="hub-error">{error}</div>}
            {!user && <div className="hub-note">로그인하면 내 기록이 보드에 적힙니다.</div>}
            <div className="board-tray" aria-hidden="true">
              <span className="marker blue" />
              <span className="marker red" />
            </div>
          </div>

          {!isMobile && renderCharacterPreviewCard()}

          {(!isMobile || showMobileCommunity) && (
            <div className="lounge-preview dg-steel dg-lift">
              <div className="card-header">
                <h3>라운지 미리보기</h3>
                <span className="card-header-note">접속 즉시 동기화</span>
              </div>
              <div className="lounge-canvas dg-rubber" aria-hidden="true">
                <span className="rack" />
                <span className="rack-bar" />
                <span className="dumbbell-rack">
                  <i />
                  <i />
                  <i />
                </span>
                <div className="lounge-avatars">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <span key={`avatar-${idx}`} className={`lounge-dot dot-${idx + 1}`} />
                  ))}
                </div>
                <span className="lounge-floor" />
              </div>
              <div className="lounge-info">
                <strong>지금 라운지에 {loungeCountLabel}명이 운동 중</strong>
                <p>캐릭터로 들어가 같이 운동하고 채팅하는 공간입니다.</p>
              </div>
              <Link to="/lounge" className="dg-btn dg-btn-primary lounge-cta">
                라운지 입장하기
              </Link>
            </div>
          )}
        </div>

        {(!isMobile || showMobileCommunity) && (
          <div className="quest-strip dg-steel">
            <div>
              <h3>오늘의 루프가 게임이 됩니다</h3>
              <p>
                출석을 완료하면 캐릭터가 바로 반응하고, 라운지에서 다른 멤버와
                실시간으로 연결됩니다.
              </p>
            </div>
            <ol className="quest-steps">
              <li>
                <span className="step-plate plate-red" />
                <div>
                  <small className="font-num">STEP 1</small>
                  <p>출석 체크</p>
                </div>
              </li>
              <li>
                <span className="step-plate plate-blue" />
                <div>
                  <small className="font-num">STEP 2</small>
                  <p>캐릭터 성장</p>
                </div>
              </li>
              <li>
                <span className="step-plate plate-yellow" />
                <div>
                  <small className="font-num">STEP 3</small>
                  <p>라운지 진입</p>
                </div>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* 휴대폰 아래 고정 바는 지도 바로 가기(출석 · 식단 · 운동 시작 · 내 기록)가 맡는다 — gymMap.css */}
    </section>
  );
}
