import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { GrowthParams } from "../components/avatar/types";
import { defaultGrowthParams } from "../components/avatar/types";

type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

type Gender = "MALE" | "FEMALE";

type CharacterResponse = {
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  avatarSeed: string;
  stylePreset: string;
  growthParams?: GrowthParams | null;
};

type PlayerState = {
  socketId: string;
  userId?: string;
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  gender?: Gender;
  avatarSeed?: string;
  stylePreset?: string;
  mbti?: string;
  growthParams?: GrowthParams;
  recentAttendanceCount?: number;
  activeEventTitle?: string;
  activeEventProgress?: string;
  x: number;
  y: number;
  lastUpdatedAt: string;
};

type ChatMessage = {
  nickname: string;
  message: string;
  ts: string;
};

type LocalUser = {
  email?: string;
  nickname: string;
  role?: string;
};

type LoungePlayersPayload = {
  players: PlayerState[];
};

type GymItem = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  description: string;
  target?: { x: number; y: number };
};

type Platform = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "solid" | "oneway" | "ladder";
};

type Npc = {
  id: string;
  name: string;
  title: string;
  x: number;
  y: number;
  mood: "guide" | "coach" | "merchant";
  lines: string[];
};

type EmoteEvent = {
  emote: string;
  ts: number;
};

type StickerEvent = {
  sticker: string;
  ts: number;
};

type MovingPlatform = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  periodMs: number;
};

type TimingPlatform = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  periodMs: number;
  duty: number;
  phaseMs?: number;
};

type MovementPresetKey = "classic" | "hardcore" | "casual";

type MovementConfig = {
  maxSpeed: number;
  sprintMultiplier: number;
  groundAccel: number;
  airAccel: number;
  groundBrake: number;
  gravity: number;
  jumpSpeed: number;
  maxFallSpeed: number;
  jumpCutMultiplier: number;
  coyoteMs: number;
  jumpBufferMs: number;
  dropDownMs: number;
  climbSpeed: number;
  oneWaySnapHeightPx: number;
  jumpThroughAllowancePx: number;
  ladderAttachXPad: number;
  ladderAttachYPad: number;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";

const DEFAULT_MAP = { width: 2000, height: 1200 };
const MOVE_EMIT_MS = 80;
const SPEECH_TTL_MS = 6000;
const PLAYER_HALF_WIDTH = 20;
const PLAYER_HALF_HEIGHT = 30;
const MOVEMENT_PRESETS: Record<MovementPresetKey, MovementConfig> = {
  classic: {
    maxSpeed: 330,
    sprintMultiplier: 1.25,
    groundAccel: 0.2,
    airAccel: 0.1,
    groundBrake: 0.24,
    gravity: 1850,
    jumpSpeed: 760,
    maxFallSpeed: 1200,
    jumpCutMultiplier: 0.52,
    coyoteMs: 110,
    jumpBufferMs: 120,
    dropDownMs: 280,
    climbSpeed: 210,
    oneWaySnapHeightPx: 2,
    jumpThroughAllowancePx: 22,
    ladderAttachXPad: 12,
    ladderAttachYPad: 12,
  },
  hardcore: {
    maxSpeed: 350,
    sprintMultiplier: 1.32,
    groundAccel: 0.18,
    airAccel: 0.09,
    groundBrake: 0.21,
    gravity: 2050,
    jumpSpeed: 735,
    maxFallSpeed: 1320,
    jumpCutMultiplier: 0.42,
    coyoteMs: 70,
    jumpBufferMs: 75,
    dropDownMs: 220,
    climbSpeed: 235,
    oneWaySnapHeightPx: 1,
    jumpThroughAllowancePx: 16,
    ladderAttachXPad: 8,
    ladderAttachYPad: 8,
  },
  casual: {
    maxSpeed: 315,
    sprintMultiplier: 1.2,
    groundAccel: 0.24,
    airAccel: 0.14,
    groundBrake: 0.3,
    gravity: 1650,
    jumpSpeed: 805,
    maxFallSpeed: 1080,
    jumpCutMultiplier: 0.62,
    coyoteMs: 170,
    jumpBufferMs: 170,
    dropDownMs: 340,
    climbSpeed: 190,
    oneWaySnapHeightPx: 4,
    jumpThroughAllowancePx: 30,
    ladderAttachXPad: 16,
    ladderAttachYPad: 16,
  },
};

const POSITION_STEP_PX = 12;
const GAMEPAD_DEADZONE = 0.2;
const PLAYER_SYNC_THROTTLE_MS = 90;
const CHAT_RENDER_LIMIT = 70;

const LOUNGE_STORAGE_KEYS = {
  zoom: "lounge_zoom_v1",
  sidebarTab: "lounge_sidebar_tab_v1",
  mutedUsers: "lounge_muted_users_v1",
  movementPreset: "lounge_movement_preset_v1",
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parseChatTimestamp = (value: string) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  return Date.now();
};

const isSystemMessage = (nickname: string, message: string) => {
  const normalized = nickname.trim().toLowerCase();
  return (
    normalized === "system" ||
    normalized === "notice" ||
    normalized === "admin" ||
    message.trim().startsWith("[SYSTEM]")
  );
};

export default function Lounge() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterResponse | null>(null);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [mapSize, setMapSize] = useState(DEFAULT_MAP);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [mbti, setMbti] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [speechMap, setSpeechMap] = useState<Record<string, { message: string; ts: number }>>({});
  const [movingMap, setMovingMap] = useState<Record<string, boolean>>({});
  const [facingMap, setFacingMap] = useState<Record<string, "left" | "right">>({});
  const [zoom, setZoom] = useState(1);
  const [selectedEquipment, setSelectedEquipment] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);
  const [recentAttendanceCount, setRecentAttendanceCount] = useState<number>(0);
  const [activeEventSummary, setActiveEventSummary] = useState<{
    title: string;
    progress: string;
  } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerState | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<Record<string, boolean>>({});
  const [sidebarTab, setSidebarTab] = useState<"players" | "profile" | "equipment" | "chat">("players");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [tabEntering, setTabEntering] = useState(false);
  const [minimapPing, setMinimapPing] = useState<{ x: number; y: number; ts: number } | null>(null);
  const [hoveredEquipment, setHoveredEquipment] = useState<GymItem | null>(null);
  const [interactionPulse, setInteractionPulse] = useState<{ x: number; y: number; ts: number } | null>(null);
  const [isSprinting, setIsSprinting] = useState(false);
  const [movementPreset, setMovementPreset] = useState<MovementPresetKey>("classic");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);
  const [hoveredNpc, setHoveredNpc] = useState<Npc | null>(null);
  const [emoteMap, setEmoteMap] = useState<Record<string, EmoteEvent>>({});
  const [stickerMap, setStickerMap] = useState<Record<string, StickerEvent>>({});
  const [followingSocketId, setFollowingSocketId] = useState<string | null>(null);
  const [partyInvites, setPartyInvites] = useState<Array<{ fromSocketId: string; nickname: string; type: "follow" | "teleport"; ts: number }>>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voicePtT, setVoicePtT] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "ready" | "recording" | "error">("idle");
  const [movementQuality, setMovementQuality] = useState<"high" | "balanced" | "performance">("balanced");
  const [miniGame, setMiniGame] = useState<{
    active: boolean;
    startedAt: number;
    durationMs: number;
    collectedIds: Record<string, boolean>;
    finishedMs: number | null;
  }>({
    active: false,
    startedAt: 0,
    durationMs: 75_000,
    collectedIds: {},
    finishedMs: null,
  });
  const [miniTimeLeftMs, setMiniTimeLeftMs] = useState(0);
  const [worldNowMs, setWorldNowMs] = useState(() => Date.now());

  const socketRef = useRef<Socket | null>(null);
  const positionRef = useRef({ x: 200, y: 200 });
  const renderPositionRef = useRef({ x: 200, y: 200 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastEmitRef = useRef(0);
  const lastRenderRef = useRef(0);
  const localPositionRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false, jump: false, sprint: false, drop: false });
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const movingTimersRef = useRef<Map<string, number>>(new Map());
  const lastPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const speechTimersRef = useRef<Map<string, number>>(new Map());
  const typingTimersRef = useRef<Map<string, number>>(new Map());
  const typingStateRef = useRef(false);
  const typingIdleRef = useRef<number | null>(null);
  const minimapInnerRef = useRef<HTMLDivElement | null>(null);
  const loungeViewportShellRef = useRef<HTMLDivElement | null>(null);
  const minimapPingTimerRef = useRef<number | null>(null);
  const playersFlushTimerRef = useRef<number | null>(null);
  const queuedPlayersRef = useRef<PlayerState[] | null>(null);
  const hasStoredSidebarTabRef = useRef(false);
  const playersRef = useRef<PlayerState[]>([]);
  const voiceEnabledRef = useRef(false);
  const sprintRef = useRef(false);
  const onGroundRef = useRef(false);
  const onOneWayRef = useRef(false);
  const jumpLatchRef = useRef(false);
  const onLadderRef = useRef(false);
  const coyoteUntilRef = useRef(0);
  const jumpBufferUntilRef = useRef(0);
  const dropDownUntilRef = useRef(0);
  const dropLatchRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const onboardingSteps = [
    { title: "이동하기", desc: "A/D로 이동하고 W 또는 Space로 점프하세요. Shift를 누르면 대시합니다. 아래+점프로 통과 발판 아래로 내려갈 수 있어요." },
    { title: "월드 상호작용", desc: "위/아래로 사다리를 타고, 장비나 NPC 근처에서 E를 눌러 상호작용하세요. 텔레포트로 빠르게 이동할 수 있어요." },
    { title: "함께 플레이", desc: "오른쪽 패널의 채팅 탭에서 접속 중인 유저를 확인하고 바로 대화를 시작하세요." },
  ] as const;

  const movementConfig = useMemo(
    () => MOVEMENT_PRESETS[movementPreset],
    [movementPreset]
  );
  const renderIntervalMs = useMemo(() => {
    if (movementQuality === "high") return 1000 / 60;
    if (movementQuality === "balanced") return 1000 / 45;
    return 1000 / 30;
  }, [movementQuality]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {
      setError("세션 데이터가 올바르지 않습니다.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem("lounge_onboarding_seen_v1");
    if (!seen) {
      setShowOnboarding(true);
      setOnboardingStep(0);
    }
  }, []);

  useEffect(() => {
    const savedZoom = localStorage.getItem(LOUNGE_STORAGE_KEYS.zoom);
    if (savedZoom) {
      const parsed = Number(savedZoom);
      if (Number.isFinite(parsed)) {
        setZoom(clamp(parsed, 0.7, 1.4));
      }
    }
    const savedMutedUsers = localStorage.getItem(LOUNGE_STORAGE_KEYS.mutedUsers);
    if (savedMutedUsers) {
      try {
        const parsed = JSON.parse(savedMutedUsers);
        if (parsed && typeof parsed === "object") {
          setMutedUsers(parsed as Record<string, boolean>);
        }
      } catch {
        localStorage.removeItem(LOUNGE_STORAGE_KEYS.mutedUsers);
      }
    }
    const savedSidebar = localStorage.getItem(LOUNGE_STORAGE_KEYS.sidebarTab);
    if (savedSidebar === "players" || savedSidebar === "profile" || savedSidebar === "equipment" || savedSidebar === "chat") {
      hasStoredSidebarTabRef.current = true;
      setSidebarTab(savedSidebar);
    }
    const savedPreset = localStorage.getItem(LOUNGE_STORAGE_KEYS.movementPreset);
    if (savedPreset === "classic" || savedPreset === "hardcore" || savedPreset === "casual") {
      setMovementPreset(savedPreset);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOUNGE_STORAGE_KEYS.zoom, String(zoom));
  }, [zoom]);

  useEffect(() => {
    localStorage.setItem(LOUNGE_STORAGE_KEYS.mutedUsers, JSON.stringify(mutedUsers));
  }, [mutedUsers]);

  useEffect(() => {
    localStorage.setItem(LOUNGE_STORAGE_KEYS.sidebarTab, sidebarTab);
  }, [sidebarTab]);

  useEffect(() => {
    localStorage.setItem(LOUNGE_STORAGE_KEYS.movementPreset, movementPreset);
  }, [movementPreset]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const loungeUrl = API_BASE ? `${API_BASE}/api/lounge/profile` : "/api/lounge/profile";
        const statsUrl = API_BASE ? `${API_BASE}/api/mypage/stats` : "/api/mypage/stats";
        const [loungeRes, statsRes] = await Promise.all([
          fetch(loungeUrl, { credentials: "include" }),
          fetch(statsUrl, { credentials: "include" }),
        ]);

        if (loungeRes.status === 401 || statsRes.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!loungeRes.ok) {
          const text = await loungeRes.text().catch(() => "");
          throw new Error(text || "Failed to load character data.");
        }
        const loungePayload = (await loungeRes.json()) as LoungeProfileResponse;
        setCharacter(loungePayload.character);
        setRecentAttendanceCount(loungePayload.recentAttendanceCount ?? 0);
        const activeEvent = loungePayload.activeEvents?.[0];
        if (activeEvent) {
          setActiveEventSummary({
            title: activeEvent.title,
            progress: `${activeEvent.currentAttendanceCount}/${activeEvent.requiredAttendanceCount}`,
          });
        } else {
          setActiveEventSummary(null);
        }

        if (statsRes.ok) {
          const statsPayload = await statsRes.json().catch(() => null);
          const nextGender = statsPayload?.gender ?? null;
          if (nextGender === "MALE" || nextGender === "FEMALE") {
            setGender(nextGender);
          }
          setMbti(statsPayload?.mbti ?? null);
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load character data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !character) return;
    const socket = io(REALTIME_URL, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setMySocketId(socket.id ?? null);
      socket.emit("lounge:join", {
        userId: user.email,
        nickname: user.nickname,
        level: character.level,
        tier: character.tier,
        evolutionStage: character.evolutionStage,
        gender: gender ?? undefined,
        avatarSeed: character.avatarSeed,
        stylePreset: character.stylePreset,
        growthParams: character.growthParams ?? undefined,
        mbti: mbti ?? undefined,
        recentAttendanceCount,
        activeEventTitle: activeEventSummary?.title,
        activeEventProgress: activeEventSummary?.progress,
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("lounge:welcome", (payload) => {
      if (payload?.mapSize?.width && payload?.mapSize?.height) {
        setMapSize({
          width: Number(payload.mapSize.width),
          height: Number(payload.mapSize.height),
        });
      }
    });

    socket.on("lounge:players", (payload: LoungePlayersPayload) => {
      const nextPlayers = payload?.players ?? [];
      queuedPlayersRef.current = nextPlayers;
      if (playersFlushTimerRef.current === null) {
        playersFlushTimerRef.current = window.setTimeout(() => {
          playersFlushTimerRef.current = null;
          if (queuedPlayersRef.current) {
            setPlayers(queuedPlayersRef.current);
            queuedPlayersRef.current = null;
          }
        }, PLAYER_SYNC_THROTTLE_MS);
      }
      nextPlayers.forEach((player) => {
        const prev = lastPositionsRef.current.get(player.socketId);
        const dx = prev ? player.x - prev.x : 0;
        const dy = prev ? player.y - prev.y : 0;
        if (Math.abs(dx) > 0.5) {
          setFacingMap((prevMap) => ({
            ...prevMap,
            [player.socketId]: dx < 0 ? "left" : "right",
          }));
        }
        if (Math.hypot(dx, dy) > 1) {
          setMovingMap((prevMap) => ({ ...prevMap, [player.socketId]: true }));
          const existing = movingTimersRef.current.get(player.socketId);
          if (existing) window.clearTimeout(existing);
          const timer = window.setTimeout(() => {
            setMovingMap((prevMap) => ({ ...prevMap, [player.socketId]: false }));
            movingTimersRef.current.delete(player.socketId);
          }, 220);
          movingTimersRef.current.set(player.socketId, timer);
        }
        lastPositionsRef.current.set(player.socketId, { x: player.x, y: player.y });
      });
      const me = nextPlayers.find((player) => player.socketId === socket.id);
      if (me) {
        const dx = positionRef.current.x - me.x;
        const dy = positionRef.current.y - me.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 80 || localPositionRef.current === null) {
          positionRef.current = { x: me.x, y: me.y };
          renderPositionRef.current = { x: me.x, y: me.y };
          localPositionRef.current = { x: me.x, y: me.y };
          velocityRef.current = { x: 0, y: 0 };
          onLadderRef.current = false;
          onOneWayRef.current = false;
          coyoteUntilRef.current = 0;
          jumpBufferUntilRef.current = 0;
          setLocalPosition({ x: me.x, y: me.y });
        }
      }
    });

    socket.on("chat:message", (payload: ChatMessage) => {
      const ts = Date.now();
      setSpeechMap((prevMap) => ({
        ...prevMap,
        [payload.nickname]: { message: payload.message, ts },
      }));
      const existing = speechTimersRef.current.get(payload.nickname);
      if (existing) window.clearTimeout(existing);
      const timer = window.setTimeout(() => {
        setSpeechMap((prevMap) => {
          const next = { ...prevMap };
          delete next[payload.nickname];
          return next;
        });
        speechTimersRef.current.delete(payload.nickname);
      }, SPEECH_TTL_MS);
      speechTimersRef.current.set(payload.nickname, timer);
      setMessages((prev) => [...prev, payload].slice(-120));
    });

    socket.on("chat:typing", (payload: { nickname: string; isTyping: boolean }) => {
      if (!payload?.nickname) return;
      if (!payload.isTyping) {
        setTypingUsers((prevMap) => {
          const next = { ...prevMap };
          delete next[payload.nickname];
          return next;
        });
        return;
      }
      const ts = Date.now();
      setTypingUsers((prevMap) => ({ ...prevMap, [payload.nickname]: ts }));
      const existing = typingTimersRef.current.get(payload.nickname);
      if (existing) window.clearTimeout(existing);
      const timer = window.setTimeout(() => {
        setTypingUsers((prevMap) => {
          const next = { ...prevMap };
          delete next[payload.nickname];
          return next;
        });
        typingTimersRef.current.delete(payload.nickname);
      }, 2000);
      typingTimersRef.current.set(payload.nickname, timer);
    });

    socket.on("ping:result", (payload: { clientTs: number; serverTs: number }) => {
      if (!payload || !Number.isFinite(payload.clientTs)) return;
      const rtt = Date.now() - payload.clientTs;
      setPingMs(Math.round(rtt));
    });

    socket.on("social:emote", (payload: { fromSocketId: string; emote: string; ts: number }) => {
      if (!payload?.fromSocketId || !payload?.emote) return;
      setEmoteMap((prev) => ({
        ...prev,
        [payload.fromSocketId]: { emote: payload.emote, ts: payload.ts || Date.now() },
      }));
      window.setTimeout(() => {
        setEmoteMap((prev) => {
          if (!prev[payload.fromSocketId]) return prev;
          const next = { ...prev };
          delete next[payload.fromSocketId];
          return next;
        });
      }, 2200);
    });

    socket.on("social:sticker", (payload: { fromSocketId: string; sticker: string; ts: number }) => {
      if (!payload?.fromSocketId || !payload?.sticker) return;
      setStickerMap((prev) => ({
        ...prev,
        [payload.fromSocketId]: { sticker: payload.sticker, ts: payload.ts || Date.now() },
      }));
      window.setTimeout(() => {
        setStickerMap((prev) => {
          if (!prev[payload.fromSocketId]) return prev;
          const next = { ...prev };
          delete next[payload.fromSocketId];
          return next;
        });
      }, 3200);
    });

    socket.on("party:follow-request", (payload: { fromSocketId: string; nickname: string; ts: number }) => {
      if (!payload?.fromSocketId || !payload?.nickname) return;
      setPartyInvites((prev) =>
        [
          ...prev,
          { fromSocketId: payload.fromSocketId, nickname: payload.nickname, type: "follow" as const, ts: payload.ts || Date.now() },
        ].slice(-6)
      );
    });

    socket.on("party:teleport-request", (payload: { fromSocketId: string; nickname: string; ts: number }) => {
      if (!payload?.fromSocketId || !payload?.nickname) return;
      setPartyInvites((prev) =>
        [
          ...prev,
          { fromSocketId: payload.fromSocketId, nickname: payload.nickname, type: "teleport" as const, ts: payload.ts || Date.now() },
        ].slice(-6)
      );
    });

    socket.on("party:follow-response", (payload: { fromSocketId: string; accepted: boolean }) => {
      if (!payload?.fromSocketId) return;
      if (payload.accepted) {
        setFollowingSocketId(payload.fromSocketId);
      } else {
        setFollowingSocketId((prev) => (prev === payload.fromSocketId ? null : prev));
      }
    });

    socket.on("party:teleport-response", (payload: { fromSocketId: string; accepted: boolean; x?: number; y?: number }) => {
      if (!payload?.fromSocketId || !payload.accepted) return;
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
      moveToMapPoint(payload.x as number, payload.y as number);
    });

    socket.on("voice:chunk", async (payload: { fromSocketId: string; audioBase64: string; mimeType?: string }) => {
      if (!voiceEnabledRef.current) return;
      if (!payload?.fromSocketId || !payload?.audioBase64) return;
      const playersList = playersRef.current;
      const me = playersList.find((player) => player.socketId === socket.id);
      const other = playersList.find((player) => player.socketId === payload.fromSocketId);
      if (!me || !other) return;
      const distance = Math.hypot(me.x - other.x, me.y - other.y);
      if (distance > 260) return;
      const volume = clamp(1 - distance / 260, 0.08, 1);
      try {
        const mimeType = payload.mimeType || "audio/webm";
        const binary = atob(payload.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = volume;
        void audio.play().catch(() => {});
        audio.onended = () => URL.revokeObjectURL(url);
      } catch {
        // ignore decode/play errors to avoid noisy logs
      }
    });

    socket.on("lounge:error", (payload) => {
      setError(payload?.message ?? "Failed to connect to lounge.");
    });

    return () => {
      if (playersFlushTimerRef.current !== null) {
        window.clearTimeout(playersFlushTimerRef.current);
        playersFlushTimerRef.current = null;
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, character, gender, mbti, recentAttendanceCount, activeEventSummary]);

  useEffect(() => {
    const handleKey = (down: boolean) => (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
      }
      if (["arrowup", "w", " "].includes(key)) {
        keysRef.current.up = down;
        keysRef.current.jump = down;
        if (down) jumpBufferUntilRef.current = performance.now() + movementConfig.jumpBufferMs;
      }
      if (["arrowdown", "s"].includes(key)) keysRef.current.down = down;
      if (["arrowleft", "a"].includes(key)) keysRef.current.left = down;
      if (["arrowright", "d"].includes(key)) keysRef.current.right = down;
      if (key === "shift") keysRef.current.sprint = down;
      if (key === "x") keysRef.current.drop = down;
      if (key === "f" && down) {
        const shell = loungeViewportShellRef.current;
        if (!shell) return;
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        } else {
          void shell.requestFullscreen().catch(() => {});
        }
      }
    };

    const onKeyDown = handleKey(true);
    const onKeyUp = handleKey(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [movementConfig.jumpBufferMs]);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
      const tickMs = movementQuality === "high" ? 50 : movementQuality === "balanced" ? 100 : 180;
    const timer = window.setInterval(() => setWorldNowMs(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [movementQuality]);

  useEffect(() => {
    if (!miniGame.active) {
      setMiniTimeLeftMs(0);
      return;
    }
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - miniGame.startedAt;
      const remain = Math.max(0, miniGame.durationMs - elapsed);
      setMiniTimeLeftMs(remain);
      if (remain <= 0) {
        setMiniGame((prev) => ({
          ...prev,
          active: false,
          finishedMs: Date.now() - prev.startedAt,
        }));
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [miniGame.active, miniGame.durationMs, miniGame.startedAt]);

  useEffect(() => {
    if (isMobile && sidebarTab === "players" && !hasStoredSidebarTabRef.current) {
      setSidebarTab("chat");
    }
  }, [isMobile, sidebarTab]);

  useEffect(() => {
    return () => {
      if (minimapPingTimerRef.current !== null) {
        window.clearTimeout(minimapPingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!interactionPulse) return;
    const timer = window.setTimeout(() => setInteractionPulse(null), 300);
    return () => window.clearTimeout(timer);
  }, [interactionPulse]);

  useEffect(() => {
    setTabEntering(true);
    const raf = window.requestAnimationFrame(() => setTabEntering(false));
    return () => window.cancelAnimationFrame(raf);
  }, [sidebarTab]);

  useEffect(() => {
    if (!connected) return;
    const interval = window.setInterval(() => {
      socketRef.current?.emit("ping:check", { clientTs: Date.now() });
    }, 3000);
    return () => window.clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      const keyDirX =
        (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);

      let padX = 0;
      const pad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
      if (pad && pad.axes.length >= 2) {
        padX = Math.abs(pad.axes[0]) > GAMEPAD_DEADZONE ? pad.axes[0] : 0;
        if (Math.abs(pad.axes[1]) > 0.75) {
          keysRef.current.jump = pad.axes[1] < -0.75;
        }
      }

      let dirX = keyDirX + padX;
      dirX = clamp(dirX, -1, 1);

      const velocity = velocityRef.current;
      const hasInput = Math.abs(dirX) > 0.01;
      const sprinting = hasInput && keysRef.current.sprint;
      const targetSpeed = movementConfig.maxSpeed * (sprinting ? movementConfig.sprintMultiplier : 1);
      const targetX = dirX * targetSpeed;
      const accel = onGroundRef.current ? movementConfig.groundAccel : movementConfig.airAccel;
      velocity.x += (targetX - velocity.x) * accel;
      if (!hasInput && onGroundRef.current) {
        velocity.x += (0 - velocity.x) * movementConfig.groundBrake;
        if (Math.abs(velocity.x) < 2) velocity.x = 0;
      }
      const nowMs = performance.now();
      const canJump = onGroundRef.current || nowMs <= coyoteUntilRef.current || onLadderRef.current;
      if (keysRef.current.down && keysRef.current.drop && onOneWayRef.current && !dropLatchRef.current) {
        dropDownUntilRef.current = nowMs + movementConfig.dropDownMs;
        velocity.y = 180;
        onGroundRef.current = false;
        onOneWayRef.current = false;
        dropLatchRef.current = true;
      }
      if (!keysRef.current.drop) {
        dropLatchRef.current = false;
      }
      if (nowMs <= jumpBufferUntilRef.current && canJump && !jumpLatchRef.current) {
        if (keysRef.current.down && !onLadderRef.current && onOneWayRef.current) {
          dropDownUntilRef.current = nowMs + movementConfig.dropDownMs;
          velocity.y = 120;
        } else {
          velocity.y = -movementConfig.jumpSpeed;
          onGroundRef.current = false;
          onLadderRef.current = false;
        }
        jumpBufferUntilRef.current = 0;
        jumpLatchRef.current = true;
      }
      if (!keysRef.current.jump) {
        jumpLatchRef.current = false;
        if (velocity.y < 0 && !onLadderRef.current) {
          velocity.y *= movementConfig.jumpCutMultiplier;
        }
      }
      if (!onLadderRef.current) {
        velocity.y = Math.min(velocity.y + movementConfig.gravity * dt, movementConfig.maxFallSpeed);
      } else {
        velocity.y = 0;
        if (keysRef.current.up) velocity.y = -movementConfig.climbSpeed;
        else if (keysRef.current.down) velocity.y = movementConfig.climbSpeed;
      }

      if (sprintRef.current !== sprinting) {
        sprintRef.current = sprinting;
        setIsSprinting(sprinting);
      }

      if (hasInput) {
        if (Math.abs(dirX) > 0.1 && mySocketId) {
          const nextFacing = dirX < 0 ? "left" : "right";
          setFacingMap((prevMap) => {
            if (prevMap[mySocketId] === nextFacing) return prevMap;
            return {
              ...prevMap,
              [mySocketId]: nextFacing,
            };
          });
        }
      }

      if (velocity.x !== 0 || velocity.y !== 0) {
        const nextX = positionRef.current.x + velocity.x * dt;
        const nextY = positionRef.current.y + velocity.y * dt;
        const resolved = resolveCollision(
          nextX,
          nextY,
          positionRef.current.x,
          positionRef.current.y,
          velocity.x,
          velocity.y
        );
        velocity.x = resolved.velocityX;
        velocity.y = resolved.velocityY;
        onGroundRef.current = resolved.onGround;
        onOneWayRef.current = resolved.onOneWay;
        if (resolved.x !== positionRef.current.x || resolved.y !== positionRef.current.y) {
          positionRef.current = { x: resolved.x, y: resolved.y };
          const frameMs = performance.now();
          const renderPos = renderPositionRef.current;
          renderPos.x += (resolved.x - renderPos.x) * 0.45;
          renderPos.y += (resolved.y - renderPos.y) * 0.38;
          if (frameMs - lastRenderRef.current > renderIntervalMs) {
            const nextPos = { x: renderPos.x, y: renderPos.y };
            localPositionRef.current = nextPos;
            setLocalPosition(nextPos);
            lastRenderRef.current = frameMs;
          }
          if (frameMs - lastEmitRef.current > MOVE_EMIT_MS) {
            socketRef.current?.emit("player:move", { x: resolved.x, y: resolved.y });
            lastEmitRef.current = frameMs;
          }
        }
        onLadderRef.current = resolved.onLadder;
        if (resolved.onGround) {
          coyoteUntilRef.current = performance.now() + movementConfig.coyoteMs;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [connected, mapSize.height, mapSize.width, movementConfig, mySocketId, renderIntervalMs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    if (!viewportRef.current) return;
    const element = viewportRef.current;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setViewportSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const intersects = (
    x: number,
    y: number,
    rect: { left: number; right: number; top: number; bottom: number }
  ) => {
    const left = x - PLAYER_HALF_WIDTH;
    const right = x + PLAYER_HALF_WIDTH;
    const top = y - PLAYER_HALF_HEIGHT;
    const bottom = y + PLAYER_HALF_HEIGHT;
    return right > rect.left && left < rect.right && bottom > rect.top && top < rect.bottom;
  };

  const collidesHard = (x: number, y: number) => {
    return hardBlocks.some((rect) => intersects(x, y, rect));
  };

  const resolveCollision = (
    rawNextX: number,
    rawNextY: number,
    prevX: number,
    prevY: number,
    velocityX: number,
    velocityY: number
  ) => {
    const nowMs = performance.now();
    const minX = PLAYER_HALF_WIDTH + 2;
    const maxX = mapSize.width - PLAYER_HALF_WIDTH - 2;
    const minY = PLAYER_HALF_HEIGHT;
    const maxY = mapSize.height - PLAYER_HALF_HEIGHT;
    let nextX = prevX;
    let nextY = prevY;
    let resolvedVx = velocityX;
    let resolvedVy = velocityY;
    let onGround = false;
    let onOneWay = false;
    let onLadder = false;

    const totalDx = clamp(rawNextX, minX, maxX) - prevX;
    const totalDy = clamp(rawNextY, minY, maxY) - prevY;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(totalDx), Math.abs(totalDy)) / POSITION_STEP_PX));
    const stepDx = totalDx / steps;
    const stepDy = totalDy / steps;
    const dropDownActive = nowMs < dropDownUntilRef.current;

    for (let i = 0; i < steps; i += 1) {
      const candX = clamp(nextX + stepDx, minX, maxX);
      if (!collidesHard(candX, nextY)) {
        nextX = candX;
      } else {
        resolvedVx = 0;
      }

      const candY = clamp(nextY + stepDy, minY, maxY);
      const blockedBySolid = collidesHard(nextX, candY);
      if (!blockedBySolid) {
        let landedOnOneWay = false;
        if (!dropDownActive && stepDy >= 0) {
          const prevBottom = nextY + PLAYER_HALF_HEIGHT;
          const nextBottom = candY + PLAYER_HALF_HEIGHT;
          landedOnOneWay = oneWayBlocks.some((block) => {
            const left = nextX - PLAYER_HALF_WIDTH;
            const right = nextX + PLAYER_HALF_WIDTH;
            const overlapsX = right > block.left + 6 && left < block.right - 6;
            return (
              overlapsX &&
              prevBottom <= block.top + movementConfig.oneWaySnapHeightPx &&
              nextBottom >= block.top - movementConfig.jumpThroughAllowancePx
            );
          });
          if (landedOnOneWay) {
            nextY = oneWayBlocks.reduce((closest, block) => {
              const left = nextX - PLAYER_HALF_WIDTH;
              const right = nextX + PLAYER_HALF_WIDTH;
              const overlapsX = right > block.left + 6 && left < block.right - 6;
              const prevBottomL = nextY + PLAYER_HALF_HEIGHT;
              const nextBottomL = candY + PLAYER_HALF_HEIGHT;
              if (
                !overlapsX ||
                !(
                  prevBottomL <= block.top + movementConfig.oneWaySnapHeightPx &&
                  nextBottomL >= block.top - movementConfig.jumpThroughAllowancePx
                )
              ) {
                return closest;
              }
              return Math.min(closest, block.top - PLAYER_HALF_HEIGHT);
            }, candY);
            resolvedVy = 0;
            onGround = true;
            onOneWay = true;
          } else {
            nextY = candY;
          }
        } else {
          nextY = candY;
        }
      } else {
        if (stepDy > 0) onGround = true;
        resolvedVy = 0;
      }
    }

    if (nextY >= maxY - 1) {
      nextY = maxY;
      resolvedVy = 0;
      onGround = true;
    }

    const onLadderZone = ladderZones.some((ladder) => {
      const ladderCenterX = (ladder.left + ladder.right) / 2;
      const withinX = Math.abs(nextX - ladderCenterX) <= PLAYER_HALF_WIDTH + movementConfig.ladderAttachXPad;
      const withinY =
        nextY + PLAYER_HALF_HEIGHT >= ladder.top - movementConfig.ladderAttachYPad &&
        nextY - PLAYER_HALF_HEIGHT <= ladder.bottom + movementConfig.ladderAttachYPad;
      return withinX && withinY;
    });
    const climbIntent = keysRef.current.up || keysRef.current.down;
    if (onLadderZone && (climbIntent || onLadderRef.current)) {
      const ladder = ladderZones.find((zone) => {
        const ladderCenterX = (zone.left + zone.right) / 2;
        const withinX = Math.abs(nextX - ladderCenterX) <= PLAYER_HALF_WIDTH + movementConfig.ladderAttachXPad;
        const withinY =
          nextY + PLAYER_HALF_HEIGHT >= zone.top - movementConfig.ladderAttachYPad &&
          nextY - PLAYER_HALF_HEIGHT <= zone.bottom + movementConfig.ladderAttachYPad;
        return withinX && withinY;
      });
      if (ladder) {
        onLadder = true;
        nextX = ladder.left + (ladder.right - ladder.left) / 2;
      }
    }

    return { x: nextX, y: nextY, velocityX: resolvedVx, velocityY: resolvedVy, onGround, onOneWay, onLadder };
  };

  const handleEquipmentClick = (item: GymItem) => {
    setSidebarTab("equipment");
    setSelectedNpc(null);
    setSelectedEquipment({
      id: item.id,
      name: item.name,
      description: item.description,
    });
    setInteractionPulse({ x: item.x + item.w / 2, y: item.y + item.h / 2, ts: Date.now() });
    if (item.type === "teleport" && item.target) {
      const target = item.target;
      positionRef.current = { x: target.x, y: target.y };
      renderPositionRef.current = { x: target.x, y: target.y };
      localPositionRef.current = { x: target.x, y: target.y };
      velocityRef.current = { x: 0, y: 0 };
      onGroundRef.current = false;
      onLadderRef.current = false;
      onOneWayRef.current = false;
      coyoteUntilRef.current = 0;
      jumpBufferUntilRef.current = 0;
      setLocalPosition({ x: target.x, y: target.y });
      socketRef.current?.emit("player:move", { x: target.x, y: target.y });
    }
  };

  const setTypingState = (isTyping: boolean) => {
    if (!socketRef.current) return;
    if (typingStateRef.current === isTyping) return;
    typingStateRef.current = isTyping;
    socketRef.current.emit("chat:typing", { isTyping });
  };

  const scheduleTypingIdle = () => {
    if (typingIdleRef.current) {
      window.clearTimeout(typingIdleRef.current);
    }
    typingIdleRef.current = window.setTimeout(() => {
      setTypingState(false);
    }, 1500);
  };

  const toggleMute = (nickname: string) => {
    setMutedUsers((prev) => ({
      ...prev,
      [nickname]: !prev[nickname],
    }));
  };

  const filterMessage = (message: string) => {
    const banned = ["badword1", "badword2"];
    let result = message;
    banned.forEach((word) => {
      if (!word) return;
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "gi");
      result = result.replace(re, "*".repeat(word.length));
    });
    return result;
  };

  const setKeyState = (key: "up" | "down" | "left" | "right" | "jump", down: boolean) => {
    keysRef.current[key] = down;
  };

  const EMOTES = ["wave", "cheer", "gg", "clap"] as const;
  const STICKERS = ["🔥", "💪", "👏", "🚀"] as const;

  const sendEmote = (emote: string) => {
    socketRef.current?.emit("social:emote", { emote });
  };

  const sendSticker = (sticker: string) => {
    socketRef.current?.emit("social:sticker", { sticker });
  };

  const clampZoom = (value: number) => clamp(value, 0.7, 1.4);
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const placeMinimapPing = (x: number, y: number) => {
    setMinimapPing({ x, y, ts: Date.now() });
    if (minimapPingTimerRef.current !== null) {
      window.clearTimeout(minimapPingTimerRef.current);
    }
    minimapPingTimerRef.current = window.setTimeout(() => {
      setMinimapPing(null);
      minimapPingTimerRef.current = null;
    }, 2200);
  };

  const moveToMapPoint = (x: number, y: number) => {
    const clampedX = clamp(x, PLAYER_HALF_WIDTH, mapSize.width - PLAYER_HALF_WIDTH);
    const clampedY = clamp(y, PLAYER_HALF_HEIGHT, mapSize.height - PLAYER_HALF_HEIGHT);
    const resolved = resolveCollision(
      clampedX,
      clampedY,
      positionRef.current.x,
      positionRef.current.y,
      0,
      0
    );
    const nextPos = { x: resolved.x, y: resolved.y };
    positionRef.current = nextPos;
    renderPositionRef.current = nextPos;
    localPositionRef.current = nextPos;
    velocityRef.current = { x: 0, y: 0 };
    onGroundRef.current = false;
    onLadderRef.current = false;
    onOneWayRef.current = false;
    coyoteUntilRef.current = 0;
    jumpBufferUntilRef.current = 0;
    setLocalPosition(nextPos);
    socketRef.current?.emit("player:move", nextPos);
  };

  const handleMinimapPoint = (clientX: number, clientY: number, mode: "move" | "ping") => {
    const minimapElement = minimapInnerRef.current;
    if (!minimapElement) return;
    const rect = minimapElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratioX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const ratioY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const mapX = ratioX * mapSize.width;
    const mapY = ratioY * mapSize.height;

    if (mode === "move" && connected) {
      moveToMapPoint(mapX, mapY);
    }
    placeMinimapPing(mapX, mapY);
  };

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.nickname.localeCompare(b.nickname));
  }, [players]);

  const renderPlayers = useMemo(() => {
    return players.map((player) => {
      if (player.socketId === mySocketId && localPosition) {
        return { ...player, x: localPosition.x, y: localPosition.y };
      }
      return player;
    });
  }, [players, mySocketId, localPosition]);

  const typingNames = useMemo(
    () => Object.keys(typingUsers).filter((name) => !mutedUsers[name]),
    [typingUsers, mutedUsers]
  );

  const chatRows = useMemo(() => {
    const visible = messages.filter((msg) => !mutedUsers[msg.nickname]).slice(-CHAT_RENDER_LIMIT);
    return visible.map((msg, idx) => {
      const tsMs = parseChatTimestamp(msg.ts);
      const prev = visible[idx - 1];
      const prevTs = prev ? parseChatTimestamp(prev.ts) : 0;
      const system = isSystemMessage(msg.nickname, msg.message);
      const groupStart =
        idx === 0 ||
        system ||
        !prev ||
        prev.nickname !== msg.nickname ||
        tsMs - prevTs > 90_000;
      return {
        ...msg,
        id: `${msg.ts}-${idx}`,
        system,
        tsMs,
        timeLabel: timeFormatter.format(new Date(tsMs)),
        groupStart,
        filteredMessage: filterMessage(msg.message),
      };
    });
  }, [messages, mutedUsers, timeFormatter]);

  const handleChatSend = () => {
    const message = chatInput.trim();
    if (!message || message.length > 200) return;
    socketRef.current?.emit("chat:send", { message });
    setChatInput("");
    setTypingState(false);
  };

  const mapBackground = useMemo(
    () => ({
      backgroundImage:
        "linear-gradient(180deg, rgba(11,18,32,0.94) 0%, rgba(12,25,44,0.96) 42%, rgba(19,37,58,0.98) 63%, rgba(9,15,28,0.99) 100%), radial-gradient(circle at 78% 18%, rgba(56,189,248,0.2), transparent 42%), radial-gradient(circle at 24% 9%, rgba(45,212,191,0.22), transparent 34%)",
    }),
    []
  );

  const gymEquipment = useMemo<GymItem[]>(
    () => [
      {
        id: "rack-1",
        type: "rack",
        x: 140,
        y: 930,
        w: 260,
        h: 120,
        name: "파워랙 구역",
        description: "스쿼트와 오버헤드 계열 복합 운동 구역입니다.",
      },
      {
        id: "rack-2",
        type: "rack",
        x: 560,
        y: 790,
        w: 260,
        h: 120,
        name: "파워랙 구역",
        description: "정확한 워밍업 후 점진적으로 중량을 올리세요.",
      },
      {
        id: "bench-1",
        type: "bench",
        x: 950,
        y: 890,
        w: 220,
        h: 80,
        name: "벤치 프레스",
        description: "상체 중심 구역입니다. 오늘의 최고 세트를 기록해보세요.",
      },
      {
        id: "bench-2",
        type: "bench",
        x: 1380,
        y: 730,
        w: 220,
        h: 80,
        name: "벤치 보조 구역",
        description: "프레스 능력 향상을 위한 보조 운동 구역입니다.",
      },
      {
        id: "tread-1",
        type: "treadmill",
        x: 1660,
        y: 950,
        w: 240,
        h: 120,
        name: "트레드밀",
        description: "가벼운 유산소로 체온과 심박을 끌어올리세요.",
      },
      {
        id: "tread-2",
        type: "treadmill",
        x: 1560,
        y: 580,
        w: 240,
        h: 120,
        name: "트레드밀",
        description: "일정한 페이스로 강도를 조절해 유산소를 진행하세요.",
      },
      {
        id: "dumbbell",
        type: "dumbbell",
        x: 740,
        y: 1030,
        w: 360,
        h: 80,
        name: "덤벨 구역",
        description: "다양한 중량으로 근육 밸런스를 강화하세요.",
      },
      {
        id: "mirrors",
        type: "mirror",
        x: 1090,
        y: 280,
        w: 620,
        h: 110,
        name: "거울 월",
        description: "실시간으로 자세와 궤적을 점검하세요.",
      },
      {
        id: "plates",
        type: "plates",
        x: 420,
        y: 1030,
        w: 160,
        h: 140,
        name: "플레이트 보관함",
        description: "목표 중량 세트를 준비하는 구역입니다.",
      },
      {
        id: "teleport-cardio",
        type: "teleport",
        x: 1840,
        y: 960,
        w: 120,
        h: 120,
        name: "텔레포트: 유산소",
        description: "클릭하면 유산소 구역으로 즉시 이동합니다.",
        target: { x: 220, y: 1020 },
      },
      {
        id: "teleport-main",
        type: "teleport",
        x: 90,
        y: 950,
        w: 120,
        h: 120,
        name: "텔레포트: 메인",
        description: "클릭하면 메인 플로어로 즉시 복귀합니다.",
        target: { x: 1670, y: 940 },
      },
    ],
    []
  );

  const platforms = useMemo<Platform[]>(
    () => [
      { id: "ground", x: 0, y: 1090, w: 2000, h: 110, kind: "solid" },
      { id: "wall-left", x: 0, y: 0, w: 28, h: 1200, kind: "solid" },
      { id: "wall-right", x: 1972, y: 0, w: 28, h: 1200, kind: "solid" },
      { id: "block-gym-1", x: 1220, y: 920, w: 90, h: 170, kind: "solid" },
      { id: "block-gym-2", x: 1480, y: 760, w: 90, h: 330, kind: "solid" },
      { id: "oneway-a", x: 110, y: 880, w: 360, h: 18, kind: "oneway" },
      { id: "oneway-b", x: 540, y: 740, w: 350, h: 18, kind: "oneway" },
      { id: "oneway-c", x: 920, y: 840, w: 380, h: 18, kind: "oneway" },
      { id: "oneway-d", x: 1360, y: 680, w: 330, h: 18, kind: "oneway" },
      { id: "oneway-e", x: 1650, y: 920, w: 250, h: 18, kind: "oneway" },
      { id: "oneway-f", x: 700, y: 980, w: 520, h: 18, kind: "oneway" },
      { id: "oneway-g", x: 280, y: 620, w: 300, h: 18, kind: "oneway" },
      { id: "oneway-h", x: 1040, y: 520, w: 280, h: 18, kind: "oneway" },
      { id: "ladder-a", x: 805, y: 746, w: 40, h: 236, kind: "ladder" },
      { id: "ladder-b", x: 1180, y: 524, w: 40, h: 318, kind: "ladder" },
      { id: "ladder-c", x: 1755, y: 682, w: 40, h: 240, kind: "ladder" },
    ],
    []
  );

  const timingPlatforms = useMemo<TimingPlatform[]>(
    () => [
      { id: "tp-1", x: 320, y: 560, w: 150, h: 16, periodMs: 2200, duty: 0.58 },
      { id: "tp-2", x: 520, y: 500, w: 150, h: 16, periodMs: 2200, duty: 0.52, phaseMs: 300 },
      { id: "tp-3", x: 720, y: 450, w: 150, h: 16, periodMs: 2200, duty: 0.48, phaseMs: 600 },
      { id: "tp-4", x: 920, y: 410, w: 150, h: 16, periodMs: 2200, duty: 0.45, phaseMs: 920 },
    ],
    []
  );

  const movingPlatforms = useMemo<MovingPlatform[]>(
    () => [
      { id: "mp-1", x1: 1180, y1: 600, x2: 1420, y2: 600, w: 130, h: 16, periodMs: 3600 },
      { id: "mp-2", x1: 1520, y1: 520, x2: 1520, y2: 760, w: 130, h: 16, periodMs: 4200 },
    ],
    []
  );

  const miniGameZone = useMemo(() => ({ x: 250, y: 360, w: 980, h: 300 }), []);

  const miniGameCoins = useMemo(
    () => [
      { id: "c-1", x: 300, y: 520 },
      { id: "c-2", x: 430, y: 470 },
      { id: "c-3", x: 570, y: 430 },
      { id: "c-4", x: 720, y: 390 },
      { id: "c-5", x: 880, y: 420 },
      { id: "c-6", x: 1030, y: 470 },
      { id: "c-7", x: 1160, y: 530 },
      { id: "c-8", x: 640, y: 560 },
    ],
    []
  );

  const npcs = useMemo<Npc[]>(
    () => [
      {
        id: "npc-deukgeun",
        name: "득근",
        title: "Gym Master",
        mood: "guide",
        x: 180,
        y: 1040,
        lines: [
          "오늘도 근성 충전 완료했나?",
          "발판 점프 동선을 익히면 맵 이동이 훨씬 빨라진다.",
        ],
      },
      {
        id: "npc-aryeong",
        name: "아령",
        title: "Form Coach",
        mood: "coach",
        x: 980,
        y: 790,
        lines: [
          "호흡 고정하고 리듬을 타.",
          "Shift 대시와 점프를 섞어 최단 루트를 만들어봐.",
        ],
      },
      {
        id: "npc-dumbel",
        name: "덤벨",
        title: "Merch Keeper",
        mood: "merchant",
        x: 1640,
        y: 640,
        lines: [
          "보급품은 아직 준비 중이야.",
          "지금은 대화만 가능하지만 곧 상점도 열린다.",
        ],
      },
    ],
    []
  );

  const worldProps = useMemo(
    () => [
      { id: "neon-a", kind: "neon", x: 90, y: 106, w: 320, h: 22 },
      { id: "neon-b", kind: "neon", x: 680, y: 90, w: 280, h: 22 },
      { id: "neon-c", kind: "neon", x: 1490, y: 100, w: 360, h: 22 },
      { id: "lamp-a", kind: "lamp", x: 120, y: 840, w: 24, h: 250 },
      { id: "lamp-b", kind: "lamp", x: 520, y: 700, w: 24, h: 390 },
      { id: "lamp-c", kind: "lamp", x: 940, y: 800, w: 24, h: 290 },
      { id: "lamp-d", kind: "lamp", x: 1320, y: 640, w: 24, h: 450 },
      { id: "lamp-e", kind: "lamp", x: 1690, y: 880, w: 24, h: 210 },
      { id: "banner-a", kind: "banner", x: 250, y: 430, w: 150, h: 220 },
      { id: "banner-b", kind: "banner", x: 1220, y: 350, w: 160, h: 240 },
      { id: "plant-a", kind: "plant", x: 82, y: 1026, w: 62, h: 64 },
      { id: "plant-b", kind: "plant", x: 612, y: 1020, w: 62, h: 70 },
      { id: "plant-c", kind: "plant", x: 1430, y: 1020, w: 62, h: 70 },
      { id: "plant-d", kind: "plant", x: 1860, y: 1020, w: 62, h: 70 },
    ],
    []
  );

  const cameraStyle = useMemo(() => {
    if (!localPosition) {
      return { transform: "translate3d(0px, 0px, 0px)" };
    }
    const scaledWidth = mapSize.width * zoom;
    const scaledHeight = mapSize.height * zoom;
    const targetX = viewportSize.width / 2 - localPosition.x * zoom;
    const targetY = viewportSize.height / 2 - localPosition.y * zoom;
    const minX = viewportSize.width - scaledWidth;
    const minY = viewportSize.height - scaledHeight;
    const clampX = clamp(targetX, minX, 0);
    const clampY = clamp(targetY, minY, 0);
    return {
      transform: `translate3d(${clampX}px, ${clampY}px, 0px) scale(${zoom})`,
      transformOrigin: "top left",
    };
  }, [localPosition, mapSize.height, mapSize.width, viewportSize.height, viewportSize.width, zoom]);

  const viewRect = useMemo(() => {
    if (!localPosition) {
      return { left: 0, top: 0, right: mapSize.width, bottom: mapSize.height };
    }
    const halfW = viewportSize.width / (2 * zoom);
    const halfH = viewportSize.height / (2 * zoom);
    return {
      left: localPosition.x - halfW - 180,
      top: localPosition.y - halfH - 180,
      right: localPosition.x + halfW + 180,
      bottom: localPosition.y + halfH + 180,
    };
  }, [localPosition, mapSize.height, mapSize.width, viewportSize.height, viewportSize.width, zoom]);

  const isRectVisible = (
    x: number,
    y: number,
    w: number,
    h: number
  ) => !(x + w < viewRect.left || x > viewRect.right || y + h < viewRect.top || y > viewRect.bottom);

  const visibleGymEquipment = useMemo(
    () => gymEquipment.filter((item) => isRectVisible(item.x, item.y, item.w, item.h)),
    [gymEquipment, viewRect]
  );

  const visibleWorldProps = useMemo(
    () => worldProps.filter((item) => isRectVisible(item.x, item.y, item.w, item.h)),
    [worldProps, viewRect]
  );

  const visiblePlatforms = useMemo(
    () => platforms.filter((item) => isRectVisible(item.x, item.y, item.w, item.h)),
    [platforms, viewRect]
  );

  const visibleNpcs = useMemo(
    () => npcs.filter((npc) => isRectVisible(npc.x - 32, npc.y - 96, 64, 112)),
    [npcs, viewRect]
  );

  const activeTimingPlatforms = useMemo(
    () =>
      timingPlatforms
        .map((platform) => {
          const phase = (worldNowMs + (platform.phaseMs ?? 0)) % platform.periodMs;
          const active = phase / platform.periodMs < platform.duty;
          return { ...platform, active };
        }),
    [timingPlatforms, worldNowMs]
  );

  const movingPlatformStates = useMemo(
    () =>
      movingPlatforms.map((platform) => {
        const t = ((worldNowMs % platform.periodMs) / platform.periodMs) * Math.PI * 2;
        const wave = (Math.sin(t) + 1) / 2;
        const x = platform.x1 + (platform.x2 - platform.x1) * wave;
        const y = platform.y1 + (platform.y2 - platform.y1) * wave;
        return { ...platform, x, y };
      }),
    [movingPlatforms, worldNowMs]
  );

  const visibleTimingPlatforms = useMemo(
    () => activeTimingPlatforms.filter((item) => isRectVisible(item.x, item.y, item.w, item.h)),
    [activeTimingPlatforms, viewRect]
  );

  const visibleMovingPlatforms = useMemo(
    () => movingPlatformStates.filter((item) => isRectVisible(item.x, item.y, item.w, item.h)),
    [movingPlatformStates, viewRect]
  );

  const solidBlocks = useMemo(
    () => {
      const base = platforms.map((item) => ({
        id: item.id,
        left: item.x,
        top: item.y,
        right: item.x + item.w,
        bottom: item.y + item.h,
        kind: item.kind,
      }));
      const timing = activeTimingPlatforms
        .filter((item) => item.active)
        .map((item) => ({
          id: item.id,
          left: item.x,
          top: item.y,
          right: item.x + item.w,
          bottom: item.y + item.h,
          kind: "oneway" as const,
        }));
      const moving = movingPlatformStates.map((item) => ({
        id: item.id,
        left: item.x,
        top: item.y,
        right: item.x + item.w,
        bottom: item.y + item.h,
        kind: "oneway" as const,
      }));
      return [...base, ...timing, ...moving];
    },
    [platforms, activeTimingPlatforms, movingPlatformStates]
  );

  const ladderZones = useMemo(
    () => solidBlocks.filter((block) => block.kind === "ladder"),
    [solidBlocks]
  );

  const hardBlocks = useMemo(
    () => solidBlocks.filter((block) => block.kind === "solid"),
    [solidBlocks]
  );

  const oneWayBlocks = useMemo(
    () => solidBlocks.filter((block) => block.kind === "oneway"),
    [solidBlocks]
  );

  const visiblePlayers = useMemo(
    () =>
      renderPlayers.filter((player) =>
        player.socketId === mySocketId
          ? true
          : isRectVisible(player.x - 70, player.y - 110, 140, 180)
      ),
    [mySocketId, renderPlayers, viewRect]
  );

  const nearestEquipment = useMemo<GymItem | null>(() => {
    if (!localPosition) return null;
    let nearestItem: GymItem | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const item of gymEquipment) {
      const centerX = item.x + item.w / 2;
      const centerY = item.y + item.h / 2;
      const distance = Math.hypot(localPosition.x - centerX, localPosition.y - centerY);
      if (distance < nearestDistance) {
        nearestItem = item;
        nearestDistance = distance;
      }
    }
    if (!nearestItem || nearestDistance > 180) return null;
    return nearestItem;
  }, [gymEquipment, localPosition]);

  const nearestNpc = useMemo<Npc | null>(() => {
    if (!localPosition) return null;
    let nearest: Npc | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const npc of npcs) {
      const distance = Math.hypot(localPosition.x - npc.x, localPosition.y - npc.y);
      if (distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    if (!nearest || nearestDistance > 165) return null;
    return nearest;
  }, [localPosition, npcs]);

  const nearestInteractableLabel = useMemo(() => {
    if (nearestNpc && nearestEquipment) {
      const npcDist = localPosition ? Math.hypot(localPosition.x - nearestNpc.x, localPosition.y - nearestNpc.y) : Infinity;
      const eqDist = localPosition
        ? Math.hypot(localPosition.x - (nearestEquipment.x + nearestEquipment.w / 2), localPosition.y - (nearestEquipment.y + nearestEquipment.h / 2))
        : Infinity;
      return npcDist <= eqDist ? `E: NPC ${nearestNpc.name}` : `E: ${nearestEquipment.name}`;
    }
    if (nearestNpc) return `E: NPC ${nearestNpc.name}`;
    if (nearestEquipment) return `E: ${nearestEquipment.name}`;
    return "장비나 NPC에 더 가까이 이동하세요";
  }, [localPosition, nearestEquipment, nearestNpc]);

  useEffect(() => {
    if (!miniGame.active || !localPosition) return;
    setMiniGame((prev) => {
      let changed = false;
      const nextCollected = { ...prev.collectedIds };
      miniGameCoins.forEach((coin) => {
        if (nextCollected[coin.id]) return;
        if (Math.hypot(localPosition.x - coin.x, localPosition.y - coin.y) < 28) {
          nextCollected[coin.id] = true;
          changed = true;
        }
      });
      if (!changed) return prev;
      const allCollected = miniGameCoins.every((coin) => nextCollected[coin.id]);
      return {
        ...prev,
        active: allCollected ? false : prev.active,
        collectedIds: nextCollected,
        finishedMs: allCollected ? Date.now() - prev.startedAt : prev.finishedMs,
      };
    });
  }, [miniGame.active, miniGameCoins, localPosition]);

  useEffect(() => {
    if (!followingSocketId || !connected) return;
    const leader = players.find((player) => player.socketId === followingSocketId);
    if (!leader) return;
    const me = players.find((player) => player.socketId === mySocketId);
    if (!me) return;
    const dx = leader.x - me.x;
    const dy = leader.y - me.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 120) return;
    const targetX = leader.x - (dx / distance) * 70;
    const targetY = leader.y - (dy / distance) * 50;
    positionRef.current = { x: targetX, y: targetY };
    renderPositionRef.current = {
      x: renderPositionRef.current.x + (targetX - renderPositionRef.current.x) * 0.45,
      y: renderPositionRef.current.y + (targetY - renderPositionRef.current.y) * 0.45,
    };
    localPositionRef.current = { x: targetX, y: targetY };
    setLocalPosition({ x: targetX, y: targetY });
    socketRef.current?.emit("player:move", { x: targetX, y: targetY });
  }, [connected, followingSocketId, mySocketId, players]);

  useEffect(() => {
    if (!voiceEnabled) {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setVoiceStatus("idle");
      return;
    }
    setVoiceStatus("ready");
  }, [voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled || !voicePtT || !socketRef.current) return;
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = async (event) => {
          if (!event.data || event.data.size === 0 || !socketRef.current) return;
          const buffer = await event.data.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          socketRef.current.emit("voice:chunk", {
            audioBase64: base64,
            mimeType: event.data.type || "audio/webm",
          });
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          mediaStreamRef.current = null;
          setVoiceStatus(voiceEnabled ? "ready" : "idle");
        };
        recorder.start(280);
        setVoiceStatus("recording");
      } catch {
        setVoiceStatus("error");
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [voiceEnabled, voicePtT]);

  useEffect(() => {
    const onInteract = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      const npc = nearestNpc;
      const equipment = nearestEquipment;
      if (!npc && !equipment) return;
      if (npc && equipment) {
        const npcDist = localPosition ? Math.hypot(localPosition.x - npc.x, localPosition.y - npc.y) : Infinity;
        const eqDist = localPosition
          ? Math.hypot(localPosition.x - (equipment.x + equipment.w / 2), localPosition.y - (equipment.y + equipment.h / 2))
          : Infinity;
        if (npcDist <= eqDist) {
          setSidebarTab("equipment");
          setSelectedNpc(npc);
          setSelectedEquipment(null);
          setInteractionPulse({ x: npc.x, y: npc.y - 22, ts: Date.now() });
        } else {
          handleEquipmentClick(equipment);
        }
        return;
      }
      if (npc) {
        setSidebarTab("equipment");
        setSelectedNpc(npc);
        setSelectedEquipment(null);
        setInteractionPulse({ x: npc.x, y: npc.y - 22, ts: Date.now() });
        return;
      }
      if (equipment) handleEquipmentClick(equipment);
    };
    window.addEventListener("keydown", onInteract);
    return () => window.removeEventListener("keydown", onInteract);
  }, [localPosition, nearestEquipment, nearestNpc]);

  const attendanceGauge = useMemo(
    () => clamp(Math.round((recentAttendanceCount / 30) * 100), 0, 100),
    [recentAttendanceCount]
  );

  const tabPanelAnimClass = `transform transition-all duration-200 ${tabEntering ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"}`;

  return (
    <section
      className="pt-28 pb-16 px-5 md:px-10 bg-gradient-to-br from-slate-950 via-gray-950 to-black min-h-screen text-white lounge-root"
      data-quality={movementQuality}
    >
      <div
        ref={loungeViewportShellRef}
        className="max-w-6xl mx-auto space-y-8 lounge-shell"
      >
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
            라운지
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            2D 운동 라운지
          </h1>
          <p className="text-gray-300">
            실시간으로 이동하고 대화할 수 있는 소셜 피트니스 공간입니다.
          </p>
        </header>

        {loading && <div className="text-gray-300">라운지 연결을 준비 중입니다...</div>}
        {error && <div className="text-rose-300">{error}</div>}

        <div className="grid lg:grid-cols-[1.4fr,0.6fr] gap-6 lounge-main-grid">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-300">
              <span>
                상태:{" "}
                <span
                  className={`font-semibold ${
                    connected ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {connected ? "연결됨" : "연결 끊김"}
                </span>
              </span>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  {character
                    ? `Lv.${character.level} ${character.tier} | 단계 ${character.evolutionStage}`
                    : "캐릭터 로딩 중..."}
                </span>
                <span className="text-[10px] text-white/60">
                  {pingMs !== null ? `핑 ${pingMs}ms` : "핑 확인 중..."}
                </span>
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    onClick={() => setZoom((prev) => clampZoom(prev - 0.1))}
                    aria-label="축소"
                    className="px-2 py-1 text-[10px] font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 rounded"
                  >
                    -
                  </button>
                  <span className="text-[10px] text-white/70">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((prev) => clampZoom(prev + 0.1))}
                    aria-label="확대"
                    className="px-2 py-1 text-[10px] font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 rounded"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => setShowHelp((prev) => !prev)}
                  aria-label="도움말 토글"
                  className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                >
                  ?
                </button>
                  <label className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70">
                  물리
                  <select
                    value={movementPreset}
                    onChange={(event) => setMovementPreset(event.target.value as MovementPresetKey)}
                    className="ml-2 rounded bg-slate-900/90 px-1 py-0.5 text-[10px] text-white focus-visible:outline-none"
                    aria-label="이동 프리셋"
                  >
                    <option value="classic">클래식</option>
                    <option value="hardcore">하드코어</option>
                    <option value="casual">캐주얼</option>
                  </select>
                </label>
                <button
                  onClick={() => {
                    const shell = loungeViewportShellRef.current;
                    if (!shell) return;
                    if (document.fullscreenElement) {
                      void document.exitFullscreen().catch(() => {});
                    } else {
                      void shell.requestFullscreen().catch(() => {});
                    }
                  }}
                  aria-label="전체화면 토글"
                  className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                >
                  {isFullscreen ? "전체화면 종료" : "전체화면"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-white/70">소셜</span>
                {EMOTES.map((emote) => (
                  <button
                    key={emote}
                    onClick={() => sendEmote(emote)}
                    className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/20"
                  >
                    {emote}
                  </button>
                ))}
                {STICKERS.map((sticker) => (
                  <button
                    key={sticker}
                    onClick={() => sendSticker(sticker)}
                    className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-sm hover:bg-emerald-500/20"
                  >
                    {sticker}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => setVoiceEnabled((prev) => !prev)}
                  className={`rounded-md border px-2 py-1 ${
                    voiceEnabled ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100" : "border-white/10 bg-black/25 text-white/70"
                  }`}
                >
                  {voiceEnabled ? "보이스 켜짐" : "보이스 꺼짐"}
                </button>
                <button
                  onMouseDown={() => setVoicePtT(true)}
                  onMouseUp={() => setVoicePtT(false)}
                  onMouseLeave={() => setVoicePtT(false)}
                  onTouchStart={() => setVoicePtT(true)}
                  onTouchEnd={() => setVoicePtT(false)}
                  disabled={!voiceEnabled}
                  className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-white/80 disabled:opacity-40"
                >
                  누르고 말하기
                </button>
                <span className="text-white/60">
                  보이스:{" "}
                  {{
                    idle: "대기",
                    ready: "준비",
                    recording: "녹음 중",
                    error: "오류",
                  }[voiceStatus]}
                </span>
                <label className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-white/70">
                  품질
                  <select
                    value={movementQuality}
                    onChange={(event) => setMovementQuality(event.target.value as "high" | "balanced" | "performance")}
                    className="ml-2 rounded bg-slate-900/90 px-1 py-0.5 text-[10px] text-white"
                  >
                    <option value="high">높음</option>
                    <option value="balanced">균형</option>
                    <option value="performance">성능</option>
                  </select>
                </label>
                {followingSocketId && (
                  <button
                    onClick={() => setFollowingSocketId(null)}
                    className="rounded-md border border-amber-300/50 bg-amber-400/20 px-2 py-1 text-amber-100"
                  >
                    따라가기 중지
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() =>
                    setMiniGame({
                      active: true,
                      startedAt: Date.now(),
                      durationMs: 75_000,
                      collectedIds: {},
                      finishedMs: null,
                    })
                  }
                  className="rounded-md border border-indigo-300/50 bg-indigo-500/20 px-2 py-1 text-indigo-100"
                >
                  타임어택 시작
                </button>
                <span className="text-white/70">
                  {miniGame.active
                    ? `남은 시간 ${Math.ceil(miniTimeLeftMs / 1000)}초 | 코인 ${Object.keys(miniGame.collectedIds).length}/${miniGameCoins.length}`
                    : miniGame.finishedMs
                      ? `최근 기록 ${(miniGame.finishedMs / 1000).toFixed(1)}초`
                      : "미니게임 대기 중"}
                </span>
              </div>
              {partyInvites.length > 0 && (
                <div className="space-y-1">
                  {partyInvites.slice(-2).map((invite) => (
                    <div key={`${invite.type}-${invite.fromSocketId}-${invite.ts}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs">
                      <span className="text-white/80">
                        {invite.nickname} | {invite.type === "follow" ? "따라가기 요청" : "순간이동 요청"}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (invite.type === "follow") {
                              socketRef.current?.emit("party:follow-response", { toSocketId: invite.fromSocketId, accepted: true });
                            } else {
                              const me = players.find((player) => player.socketId === mySocketId);
                              socketRef.current?.emit("party:teleport-response", {
                                toSocketId: invite.fromSocketId,
                                accepted: true,
                                x: me?.x,
                                y: me?.y,
                              });
                            }
                            setPartyInvites((prev) => prev.filter((item) => item.ts !== invite.ts));
                          }}
                          className="rounded bg-emerald-400/20 px-2 py-0.5 text-emerald-100"
                        >
                          수락
                        </button>
                        <button
                          onClick={() => {
                            if (invite.type === "follow") {
                              socketRef.current?.emit("party:follow-response", { toSocketId: invite.fromSocketId, accepted: false });
                            } else {
                              socketRef.current?.emit("party:teleport-response", {
                                toSocketId: invite.fromSocketId,
                                accepted: false,
                              });
                            }
                            setPartyInvites((prev) => prev.filter((item) => item.ts !== invite.ts));
                          }}
                          className="rounded bg-rose-400/20 px-2 py-0.5 text-rose-100"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div
                ref={(element) => {
                  viewportRef.current = element;
                }}
                className="relative h-[78vh] w-full overflow-hidden rounded-2xl border border-white/10 lounge-viewport"
                style={mapBackground}
                onWheel={(event) => {
                  if (!event.ctrlKey) return;
                  event.preventDefault();
                  const delta = event.deltaY > 0 ? -0.05 : 0.05;
                  setZoom((prev) => clampZoom(prev + delta));
                }}
              >
                <div className="lounge-hud">
                  <div className="hud-chip">
                    <span className="hud-label">접속</span>
                    <strong>{players.length}</strong>
                  </div>
                  <div className="hud-chip">
                    <span className="hud-label">핑</span>
                    <strong>{pingMs !== null ? `${pingMs}ms` : "..."}</strong>
                  </div>
                  <div className="hud-chip hud-chip-wide">
                    <span className="hud-label">드라이브</span>
                    <div className="hud-gauge">
                      <div className="hud-gauge-fill" style={{ width: `${attendanceGauge}%` }} />
                    </div>
                    <strong>{attendanceGauge}%</strong>
                  </div>
                  <div className={`hud-chip ${isSprinting ? "hud-chip-active" : ""}`}>
                    <span className="hud-label">시프트</span>
                    <strong>{isSprinting ? "부스트" : "걷기"}</strong>
                  </div>
                  <div className="hud-chip">
                    <span className="hud-label">프리셋</span>
                    <strong>
                      {{
                        classic: "클래식",
                        hardcore: "하드코어",
                        casual: "캐주얼",
                      }[movementPreset]}
                    </strong>
                  </div>
                  <div className={`hud-chip ${onLadderRef.current ? "hud-chip-active" : ""}`}>
                    <span className="hud-label">이동 모드</span>
                    <strong>{onLadderRef.current ? "사다리" : "지상"}</strong>
                  </div>
                  <div className="hud-chip hud-chip-wide">
                    <span className="hud-label">상호작용</span>
                    <strong>{nearestInteractableLabel}</strong>
                  </div>
                </div>
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{ ...cameraStyle, width: mapSize.width, height: mapSize.height }}
                >
                  <div className="absolute inset-8 border border-cyan-200/10 rounded-3xl pointer-events-none" />
                  <div className="absolute inset-16 border border-white/5 rounded-[28px] pointer-events-none" />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-12 left-[12%] h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
                    <div className="absolute top-14 right-[16%] h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />
                    <div className="absolute top-40 left-[2%] h-40 w-[620px] mountain-layer mountain-near" />
                    <div className="absolute top-48 left-[30%] h-40 w-[760px] mountain-layer mountain-far" />
                    <div className="absolute top-36 right-[2%] h-44 w-[680px] mountain-layer mountain-near" />
                    <div className="absolute top-24 left-24 h-2 w-[520px] rounded-full bg-gradient-to-r from-emerald-500/30 to-transparent opacity-60" />
                    <div className="absolute top-36 left-32 h-2 w-[420px] rounded-full bg-gradient-to-r from-sky-400/30 to-transparent opacity-45" />
                    <div className="absolute bottom-28 right-32 h-2 w-[520px] rounded-full bg-gradient-to-l from-emerald-500/35 to-transparent opacity-45" />
                    <div className="zone-label" style={{ left: 150, top: 805 }}>
                      프리웨이트
                    </div>
                    <div className="zone-label" style={{ left: 1460, top: 790 }}>
                      유산소 존
                    </div>
                  </div>

                  <svg
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    width={mapSize.width}
                    height={mapSize.height}
                    viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}
                    aria-hidden
                  >
                    <defs>
                      <pattern id="dumbbell-pattern" width="160" height="160" patternUnits="userSpaceOnUse">
                        <rect x="20" y="80" width="120" height="8" rx="4" fill="rgba(148,163,184,0.18)" />
                        <rect x="10" y="70" width="18" height="28" rx="4" fill="rgba(148,163,184,0.2)" />
                        <rect x="132" y="70" width="18" height="28" rx="4" fill="rgba(148,163,184,0.2)" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dumbbell-pattern)" />
                  </svg>
                  {visiblePlatforms.map((platform) => (
                    <div
                      key={platform.id}
                      className={`absolute ${
                        platform.kind === "solid" && platform.id === "ground"
                          ? "map-ground"
                          : platform.kind === "ladder"
                            ? "map-ladder"
                            : platform.kind === "oneway"
                              ? "map-platform-oneway"
                              : "map-platform"
                      }`}
                      style={{
                        left: platform.x,
                        top: platform.y,
                        width: platform.w,
                        height: platform.h,
                      }}
                    />
                  ))}
                  {visibleTimingPlatforms.map((platform) => (
                    <div
                      key={platform.id}
                      className={`absolute map-platform-oneway ${platform.active ? "map-timing-on" : "map-timing-off"}`}
                      style={{ left: platform.x, top: platform.y, width: platform.w, height: platform.h }}
                    />
                  ))}
                  {visibleMovingPlatforms.map((platform) => (
                    <div
                      key={platform.id}
                      className="absolute map-platform-oneway map-moving-platform"
                      style={{ left: platform.x, top: platform.y, width: platform.w, height: platform.h }}
                    />
                  ))}
                  <div
                    className="absolute minigame-zone"
                    style={{
                      left: miniGameZone.x,
                      top: miniGameZone.y,
                      width: miniGameZone.w,
                      height: miniGameZone.h,
                    }}
                  />
                  {miniGame.active &&
                    miniGameCoins
                      .filter((coin) => !miniGame.collectedIds[coin.id])
                      .map((coin) => (
                        <span
                          key={coin.id}
                          className="coin-item"
                          style={{ left: coin.x, top: coin.y }}
                        />
                      ))}
                  {visibleWorldProps.map((prop) => (
                    <div
                      key={prop.id}
                      className={`absolute world-prop world-prop-${prop.kind}`}
                      style={{ left: prop.x, top: prop.y, width: prop.w, height: prop.h }}
                    />
                  ))}

                  {visibleGymEquipment.map((item) => (
                    <div
                      key={item.id}
                      className={`absolute gym-${item.type} gym-interactive ${
                        selectedEquipment?.id === item.id ? "gym-selected" : ""
                      }`}
                      style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
                      onMouseEnter={() => setHoveredEquipment(item)}
                      onMouseLeave={() => setHoveredEquipment((prev) => (prev?.id === item.id ? null : prev))}
                      onClick={() =>
                        handleEquipmentClick(item)
                      }
                    />
                  ))}
                  {hoveredEquipment && (
                    <div
                      className="equipment-tooltip"
                      style={{
                        left: hoveredEquipment.x + hoveredEquipment.w / 2,
                        top: hoveredEquipment.y - 18,
                      }}
                    >
                      <div className="equipment-tooltip-name">{hoveredEquipment.name}</div>
                      <div className="equipment-tooltip-desc">{hoveredEquipment.description}</div>
                    </div>
                  )}
                  {interactionPulse && (
                    <div
                      className="interaction-pulse"
                      style={{ left: interactionPulse.x, top: interactionPulse.y }}
                    />
                  )}
                  {visibleNpcs.map((npc) => {
                    const selected = selectedNpc?.id === npc.id;
                    const hovered = hoveredNpc?.id === npc.id;
                    return (
                      <button
                        key={npc.id}
                        type="button"
                        className={`absolute npc-sprite npc-${npc.mood} ${selected ? "npc-selected" : ""} ${hovered ? "npc-hovered" : ""}`}
                        style={{ left: npc.x, top: npc.y }}
                        onMouseEnter={() => setHoveredNpc(npc)}
                        onMouseLeave={() => setHoveredNpc((prev) => (prev?.id === npc.id ? null : prev))}
                        onClick={() => {
                          setSidebarTab("equipment");
                          setSelectedNpc(npc);
                          setSelectedEquipment(null);
                          setInteractionPulse({ x: npc.x, y: npc.y - 22, ts: Date.now() });
                        }}
                        aria-label={`NPC ${npc.name}`}
                      >
                        <span className="npc-shadow" />
                        <span className="npc-figure">
                          <span className="npc-hair" />
                          <span className="npc-head">
                            <span className="npc-eye npc-eye-left" />
                            <span className="npc-eye npc-eye-right" />
                            <span className="npc-mouth" />
                          </span>
                          <span className="npc-torso" />
                          <span className="npc-arm npc-arm-left" />
                          <span className="npc-arm npc-arm-right" />
                          <span className="npc-leg npc-leg-left" />
                          <span className="npc-leg npc-leg-right" />
                        </span>
                        <span className="npc-nameplate">
                          {npc.name}
                        </span>
                      </button>
                    );
                  })}

                  {visiblePlayers.map((player) => {
                    const isMe = player.socketId === mySocketId;
                    const isMoving =
                      (isMe && (keysRef.current.left || keysRef.current.right || !onGroundRef.current)) ||
                      movingMap[player.socketId];
                    const muted = mutedUsers[player.nickname];
                    const speech = muted ? null : speechMap[player.nickname];
                    const speechText = speech ? filterMessage(speech.message) : "";
                    const isTyping = !muted && Boolean(typingUsers[player.nickname]);
                    const showProximity =
                      Boolean(localPosition) &&
                      Math.hypot(player.x - (localPosition?.x ?? 0), player.y - (localPosition?.y ?? 0)) < 180;
                    return (
                      <div
                        key={player.socketId}
                        className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-100 ease-linear"
                        style={{
                          left: player.x,
                          top: player.y,
                        }}
                        onClick={() => setSelectedPlayer(player)}
                      >
                        {speech && (
                          <div className="speech-bubble">
                            {speechText}
                          </div>
                        )}
                        {emoteMap[player.socketId] && (
                          <div className="emote-bubble">{emoteMap[player.socketId].emote}</div>
                        )}
                        {stickerMap[player.socketId] && (
                          <div className="sticker-bubble">{stickerMap[player.socketId].sticker}</div>
                        )}
                        {showProximity && (
                          <div className="proximity-badge">
                            {player.nickname} | Lv.{player.level} | {player.tier} | S{player.evolutionStage}
                          </div>
                        )}
                        {isTyping && !speech && (
                          <div className="typing-bubble">...</div>
                        )}
                        <div className={isMoving ? "avatar-walk" : "avatar-squat"}>
                          <PlayerAvatar
                            nickname={player.nickname}
                            level={player.level}
                            tier={player.tier}
                            evolutionStage={player.evolutionStage}
                            avatarSeed={player.avatarSeed}
                            growthParams={player.growthParams}
                            mbti={player.mbti}
                            facing={facingMap[player.socketId] ?? "right"}
                            isMe={isMe}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {minimapPing && (
                    <div
                      className="ping-marker"
                      style={{
                        left: minimapPing.x,
                        top: minimapPing.y,
                      }}
                    />
                  )}
                </div>

                <div className="minimap">
                  <div
                    ref={minimapInnerRef}
                    className="minimap-inner"
                    role="button"
                    tabIndex={0}
                    aria-label="Mini map navigation"
                    onClick={(event) => {
                      const mode = event.shiftKey || event.altKey ? "ping" : "move";
                      handleMinimapPoint(event.clientX, event.clientY, mode);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      handleMinimapPoint(event.clientX, event.clientY, "ping");
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      const rect = minimapInnerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      handleMinimapPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, "move");
                    }}
                  >
                    {platforms.map((platform) => (
                      <span
                        key={`mini-platform-${platform.id}`}
                        className={`minimap-item ${
                          platform.kind === "solid" && platform.id === "ground"
                            ? "minimap-ground"
                            : platform.kind === "ladder"
                              ? "minimap-ladder"
                              : "minimap-platform"
                        }`}
                        style={{
                          left: `${(platform.x / mapSize.width) * 100}%`,
                          top: `${(platform.y / mapSize.height) * 100}%`,
                          width: `${(platform.w / mapSize.width) * 100}%`,
                          height: `${(platform.h / mapSize.height) * 100}%`,
                        }}
                      />
                    ))}
                    {gymEquipment.map((item) => (
                      <span
                        key={`mini-${item.id}`}
                        className={`minimap-item ${item.type === "teleport" ? "minimap-teleport" : ""}`}
                        style={{
                          left: `${(item.x / mapSize.width) * 100}%`,
                          top: `${(item.y / mapSize.height) * 100}%`,
                          width: `${(item.w / mapSize.width) * 100}%`,
                          height: `${(item.h / mapSize.height) * 100}%`,
                        }}
                      />
                    ))}
                    {renderPlayers.map((player) => (
                      <span
                        key={`mini-player-${player.socketId}`}
                        className={`minimap-dot ${player.socketId === mySocketId ? "minimap-me" : ""}`}
                        style={{
                          left: `${(player.x / mapSize.width) * 100}%`,
                          top: `${(player.y / mapSize.height) * 100}%`,
                        }}
                      />
                    ))}
                    {npcs.map((npc) => (
                      <span
                        key={`mini-npc-${npc.id}`}
                        className="minimap-npc"
                        style={{
                          left: `${(npc.x / mapSize.width) * 100}%`,
                          top: `${(npc.y / mapSize.height) * 100}%`,
                        }}
                      />
                    ))}
                    {minimapPing && (
                      <span
                        className="minimap-ping"
                        style={{
                          left: `${(minimapPing.x / mapSize.width) * 100}%`,
                          top: `${(minimapPing.y / mapSize.height) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>

                {isMobile && (
                  <div className="mobile-controls">
                    <button
                      onTouchStart={() => {
                        setKeyState("jump", true);
                        setKeyState("up", true);
                      }}
                      onTouchEnd={() => {
                        setKeyState("jump", false);
                        setKeyState("up", false);
                      }}
                      onTouchCancel={() => {
                        setKeyState("jump", false);
                        setKeyState("up", false);
                      }}
                      className="ctrl-btn"
                      aria-label="점프"
                    >
                      J
                    </button>
                    <div className="ctrl-row">
                      <button
                        onTouchStart={() => setKeyState("left", true)}
                        onTouchEnd={() => setKeyState("left", false)}
                        onTouchCancel={() => setKeyState("left", false)}
                        className="ctrl-btn"
                        aria-label="왼쪽 이동"
                      >
                        L
                      </button>
                      <button
                        onTouchStart={() => setKeyState("down", true)}
                        onTouchEnd={() => setKeyState("down", false)}
                        onTouchCancel={() => setKeyState("down", false)}
                        className="ctrl-btn"
                        aria-label="아래 이동"
                      >
                        D
                      </button>
                      <button
                        onTouchStart={() => setKeyState("right", true)}
                        onTouchEnd={() => setKeyState("right", false)}
                        onTouchCancel={() => setKeyState("right", false)}
                        className="ctrl-btn"
                        aria-label="오른쪽 이동"
                      >
                        R
                      </button>
                    </div>
                  </div>
                )}

                {!connected && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 bg-black/40">
                    연결 대기 중...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="grid grid-cols-4 gap-1 text-xs">
                {[
                  { key: "players", label: "플레이어" },
                  { key: "profile", label: "프로필" },
                  { key: "equipment", label: "장비" },
                  { key: "chat", label: "채팅" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSidebarTab(tab.key as "players" | "profile" | "equipment" | "chat")}
                    className={`rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
                      sidebarTab === tab.key
                        ? "bg-emerald-400 text-black font-semibold"
                        : "text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {sidebarTab === "players" && (
              <div className={`${tabPanelAnimClass} rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">플레이어</h2>
                  <span className="text-xs text-gray-400">접속 {players.length}명</span>
                </div>
                <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1">
                  {sortedPlayers.map((player) => (
                    <div
                      key={`list-${player.socketId}`}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                        player.socketId === mySocketId
                          ? "border border-emerald-400/40 bg-emerald-500/20"
                          : "border border-white/5 bg-white/5"
                      }`}
                    >
                      <div className="font-semibold">{player.nickname}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <span>Lv.{player.level} {player.tier}</span>
                        {player.socketId !== mySocketId && (
                          <button
                            onClick={() => toggleMute(player.nickname)}
                            className="rounded text-[10px] text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                          >
                            {mutedUsers[player.nickname] ? "음소거 해제" : "음소거"}
                          </button>
                        )}
                        {player.socketId !== mySocketId && (
                          <button
                            onClick={() => socketRef.current?.emit("party:follow-request", { toSocketId: player.socketId })}
                            className="rounded text-[10px] text-cyan-300/80 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                          >
                            따라가기
                          </button>
                        )}
                        {player.socketId !== mySocketId && (
                          <button
                            onClick={() => socketRef.current?.emit("party:teleport-request", { toSocketId: player.socketId })}
                            className="rounded text-[10px] text-amber-300/80 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                          >
                            순간이동 요청
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {players.length === 0 && <div className="text-xs text-gray-400">아직 접속한 플레이어가 없습니다.</div>}
                </div>
              </div>
            )}

            {sidebarTab === "profile" && (
              <div className={`${tabPanelAnimClass} rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">프로필 카드</h2>
                  {selectedPlayer && (
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="rounded text-xs text-gray-400 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    >
                      닫기
                    </button>
                  )}
                </div>
                {selectedPlayer ? (
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex items-center gap-3">
                      <AvatarRenderer
                        avatarSeed={selectedPlayer.avatarSeed ?? `${selectedPlayer.nickname}-seed`}
                        growthParams={selectedPlayer.growthParams ?? defaultGrowthParams}
                        tier={selectedPlayer.tier}
                        stage={selectedPlayer.evolutionStage}
                        mbti={selectedPlayer.mbti}
                        size={90}
                      />
                      <div>
                        <div className="font-semibold text-white">{selectedPlayer.nickname}</div>
                        <div className="text-xs text-gray-400">
                          Lv.{selectedPlayer.level} {selectedPlayer.tier} 단계 {selectedPlayer.evolutionStage}
                        </div>
                      </div>
                    </div>
                    <div className="profile-line">
                      <span>최근 출석</span>
                      <span className="font-semibold text-white">{selectedPlayer.recentAttendanceCount ?? 0}</span>
                    </div>
                    <div className="profile-line">
                      <span>진행 이벤트</span>
                      <span className="font-semibold text-white">{selectedPlayer.activeEventTitle ?? "없음"}</span>
                    </div>
                    {selectedPlayer.activeEventProgress && (
                      <div className="profile-line">
                        <span>진행도</span>
                        <span className="font-semibold text-white">{selectedPlayer.activeEventProgress}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">라운지의 아바타를 클릭하면 상세 정보를 볼 수 있습니다.</div>
                )}
              </div>
            )}

            {sidebarTab === "equipment" && (
              <div className={`${tabPanelAnimClass} rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">장비 정보</h2>
                  {(selectedEquipment || selectedNpc) && (
                    <button
                      onClick={() => {
                        setSelectedEquipment(null);
                        setSelectedNpc(null);
                      }}
                      className="rounded text-xs text-gray-400 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    >
                      닫기
                    </button>
                  )}
                </div>
                {selectedNpc ? (
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="font-semibold text-cyan-200">{selectedNpc.name} | {selectedNpc.title}</div>
                    <div className="rounded-xl border border-cyan-200/20 bg-cyan-400/5 px-3 py-2 text-cyan-100">
                      {selectedNpc.lines[0]}
                    </div>
                    {selectedNpc.lines[1] && (
                      <p className="text-gray-300">{selectedNpc.lines[1]}</p>
                    )}
                    <div className="text-xs text-gray-500">NPC 기본 상호작용 모드입니다. 이후 추가 액션을 연결할 수 있습니다.</div>
                  </div>
                ) : selectedEquipment ? (
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="font-semibold text-white">{selectedEquipment.name}</div>
                    <p className="text-gray-300">{selectedEquipment.description}</p>
                    <div className="text-xs text-gray-500">아이템을 다시 클릭하면 강조 표시됩니다.</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">맵에서 장비 또는 NPC를 클릭하면 상세 정보를 확인할 수 있습니다.</div>
                )}
              </div>
            )}

            {sidebarTab === "chat" && (
              <div className={`${tabPanelAnimClass} flex h-[35vh] flex-col rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <h2 className="mb-3 text-lg font-semibold">실시간 채팅</h2>
                <div className="flex-1 space-y-2 overflow-y-auto pr-2 text-sm">
                  {chatRows.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl border px-3 py-2 ${
                        msg.system
                          ? "border-sky-300/30 bg-sky-500/10 text-sky-100"
                          : "border-white/10 bg-black/20 text-gray-100"
                      }`}
                    >
                      {msg.system ? (
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">시스템</span>
                          <span className="text-[10px] text-sky-200/80">{msg.timeLabel}</span>
                        </div>
                      ) : (
                        msg.groupStart && (
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-emerald-300">{msg.nickname}</span>
                            <span className="text-gray-400">{msg.timeLabel}</span>
                          </div>
                        )
                      )}
                      <div className="break-words">{msg.filteredMessage}</div>
                      {!msg.system && (
                        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-gray-400">
                          <button
                            onClick={() => toggleMute(msg.nickname)}
                            className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                          >
                            {mutedUsers[msg.nickname] ? "음소거 해제" : "음소거"}
                          </button>
                          <button
                            onClick={() => alert(`신고가 접수되었습니다: ${msg.nickname}`)}
                            className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                          >
                            신고
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {chatRows.length === 0 && <div className="text-xs text-gray-400">대화를 시작해보세요.</div>}
                  <div ref={chatEndRef} />
                </div>
                {typingNames.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    {typingNames.slice(0, 3).join(", ")}
                    {typingNames.length > 3 ? " 외" : ""} 입력 중...
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label="채팅 메시지 입력"
                    value={chatInput}
                    onChange={(event) => {
                      const next = event.target.value;
                      setChatInput(next);
                      if (next.trim().length > 0) {
                        setTypingState(true);
                        scheduleTypingIdle();
                      } else {
                        setTypingState(false);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleChatSend();
                      }
                    }}
                    onBlur={() => setTypingState(false)}
                    maxLength={200}
                    placeholder="메시지를 입력하세요 (최대 200자)"
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!connected}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
                  >
                    전송
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-300/30 bg-slate-900 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">라운지 가이드</p>
            <h3 className="mt-2 text-xl font-bold text-white">{onboardingSteps[onboardingStep].title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{onboardingSteps[onboardingStep].desc}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-gray-400">{onboardingStep + 1} / {onboardingSteps.length}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOnboardingStep((prev) => Math.max(0, prev - 1))}
                  disabled={onboardingStep === 0}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-200 disabled:opacity-40"
                >
                  이전
                </button>
                {onboardingStep < onboardingSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep((prev) => Math.min(onboardingSteps.length - 1, prev + 1))}
                    className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black"
                  >
                    다음
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("lounge_onboarding_seen_v1", "1");
                      setShowOnboarding(false);
                    }}
                    className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black"
                  >
                    시작하기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="help-overlay">
          <div className="help-card">
            <div className="help-title">라운지 조작법</div>
            <ul className="help-list">
              <li>`A/D` 또는 좌/우 방향키로 이동하고, `W`/`위`/`Space`로 점프합니다.</li>
              <li>이동 중 `Shift`를 누르면 부스트 달리기가 됩니다.</li>
              <li>`아래 + 점프` 또는 `아래 + X`로 통과 발판 아래로 내려갈 수 있습니다.</li>
              <li>사다리에서 `위/아래`로 이동하고 `점프`로 이탈합니다.</li>
              <li>물리 프리셋은 `클래식`, `하드코어`, `캐주얼` 중 선택할 수 있습니다.</li>
              <li>`Ctrl + 마우스 휠` 또는 상단 +/- 버튼으로 확대/축소합니다.</li>
              <li>`F` 키(또는 전체화면 버튼)로 전체화면을 전환합니다.</li>
              <li>소셜 패널에서 이모트, 스티커, 근접 보이스(PTT)를 사용할 수 있습니다.</li>
              <li>파티 기능으로 따라가기 요청, 순간이동 요청을 보낼 수 있습니다.</li>
              <li>미니게임은 타임어택 시작 후 구역 내 코인을 모두 수집하면 완료됩니다.</li>
              <li>장비/NPC 근처에서 `E`를 누르거나 직접 클릭해 상호작용합니다.</li>
              <li>플레이어 목록과 채팅 패널에서 음소거 또는 신고할 수 있습니다.</li>
            </ul>
            <button className="help-close" onClick={() => setShowHelp(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
type LoungeProfileResponse = {
  nickname: string;
  character: {
    level: number;
    tier: CharacterTier;
    evolutionStage: number;
    avatarSeed: string;
    stylePreset: string;
    growthParams?: GrowthParams | null;
  };
  recentAttendanceCount: number;
  activeEvents: Array<{
    eventId: number;
    title: string;
    requiredAttendanceCount: number;
    currentAttendanceCount: number;
    status: string;
    success?: boolean | null;
  }>;
};

