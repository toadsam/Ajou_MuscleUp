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

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";

const DEFAULT_MAP = { width: 2000, height: 1200 };
const MOVE_EMIT_MS = 80;
const RENDER_FPS = 60;
const SPEECH_TTL_MS = 6000;
const PLAYER_RADIUS = 28;
const ACCEL = 1400;
const FRICTION = 0.82;
const MAX_SPEED = 420;
const GAMEPAD_DEADZONE = 0.2;
const PLAYER_SYNC_THROTTLE_MS = 90;
const CHAT_RENDER_LIMIT = 70;

const LOUNGE_STORAGE_KEYS = {
  zoom: "lounge_zoom_v1",
  sidebarTab: "lounge_sidebar_tab_v1",
  mutedUsers: "lounge_muted_users_v1",
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

  const socketRef = useRef<Socket | null>(null);
  const positionRef = useRef({ x: 200, y: 200 });
  const renderPositionRef = useRef({ x: 200, y: 200 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastEmitRef = useRef(0);
  const lastRenderRef = useRef(0);
  const localPositionRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const movingTimersRef = useRef<Map<string, number>>(new Map());
  const lastPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const speechTimersRef = useRef<Map<string, number>>(new Map());
  const typingTimersRef = useRef<Map<string, number>>(new Map());
  const typingStateRef = useRef(false);
  const typingIdleRef = useRef<number | null>(null);
  const minimapInnerRef = useRef<HTMLDivElement | null>(null);
  const minimapPingTimerRef = useRef<number | null>(null);
  const playersFlushTimerRef = useRef<number | null>(null);
  const queuedPlayersRef = useRef<PlayerState[] | null>(null);
  const hasStoredSidebarTabRef = useRef(false);

  const onboardingSteps = [
    { title: "Move Around", desc: "Use WASD or arrow keys to move. On mobile, use the on-screen controls." },
    { title: "Interact", desc: "Click gym equipment to view details. Teleport pads move you between zones instantly." },
    { title: "Chat", desc: "See who is online and start chatting from the chat tab in the right panel." },
  ] as const;

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      setError("Login is required.");
      setLoading(false);
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {
      setError("Session data is invalid.");
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
      if (["arrowup", "w"].includes(key)) keysRef.current.up = down;
      if (["arrowdown", "s"].includes(key)) keysRef.current.down = down;
      if (["arrowleft", "a"].includes(key)) keysRef.current.left = down;
      if (["arrowright", "d"].includes(key)) keysRef.current.right = down;
    };

    const onKeyDown = handleKey(true);
    const onKeyUp = handleKey(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const keyDirX =
        (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      const keyDirY =
        (keysRef.current.down ? 1 : 0) - (keysRef.current.up ? 1 : 0);

      let padX = 0;
      let padY = 0;
      const pad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
      if (pad && pad.axes.length >= 2) {
        padX = Math.abs(pad.axes[0]) > GAMEPAD_DEADZONE ? pad.axes[0] : 0;
        padY = Math.abs(pad.axes[1]) > GAMEPAD_DEADZONE ? pad.axes[1] : 0;
      }

      let dirX = keyDirX + padX;
      let dirY = keyDirY + padY;
      const magnitude = Math.hypot(dirX, dirY);
      if (magnitude > 1) {
        dirX /= magnitude;
        dirY /= magnitude;
      }

      const velocity = velocityRef.current;
      if (dirX !== 0 || dirY !== 0) {
        velocity.x += dirX * ACCEL * dt;
        velocity.y += dirY * ACCEL * dt;
        const speed = Math.hypot(velocity.x, velocity.y);
        if (speed > MAX_SPEED) {
          velocity.x = (velocity.x / speed) * MAX_SPEED;
          velocity.y = (velocity.y / speed) * MAX_SPEED;
        }
        if (Math.abs(dirX) > 0.1 && mySocketId) {
          setFacingMap((prevMap) => ({
            ...prevMap,
            [mySocketId]: dirX < 0 ? "left" : "right",
          }));
        }
      } else {
        velocity.x *= FRICTION;
        velocity.y *= FRICTION;
        if (Math.abs(velocity.x) < 5) velocity.x = 0;
        if (Math.abs(velocity.y) < 5) velocity.y = 0;
      }

      if (velocity.x !== 0 || velocity.y !== 0) {
        const nextX = clamp(
          positionRef.current.x + velocity.x * dt,
          PLAYER_RADIUS,
          mapSize.width - PLAYER_RADIUS
        );
        const nextY = clamp(
          positionRef.current.y + velocity.y * dt,
          PLAYER_RADIUS,
          mapSize.height - PLAYER_RADIUS
        );
        const resolved = resolveCollision(nextX, nextY, positionRef.current.x, positionRef.current.y);
        if (resolved.x !== positionRef.current.x || resolved.y !== positionRef.current.y) {
          positionRef.current = resolved;
          const nowMs = performance.now();
          const renderPos = renderPositionRef.current;
          renderPos.x += (resolved.x - renderPos.x) * 0.35;
          renderPos.y += (resolved.y - renderPos.y) * 0.35;
          if (nowMs - lastRenderRef.current > 1000 / RENDER_FPS) {
            const nextPos = { x: renderPos.x, y: renderPos.y };
            localPositionRef.current = nextPos;
            setLocalPosition(nextPos);
            lastRenderRef.current = nowMs;
          }
          if (nowMs - lastEmitRef.current > MOVE_EMIT_MS) {
            socketRef.current?.emit("player:move", positionRef.current);
            lastEmitRef.current = nowMs;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [connected, mapSize.height, mapSize.width]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const collides = (x: number, y: number) => {
    return collisionBlocks.some((rect) => {
      const closestX = clamp(x, rect.left, rect.right);
      const closestY = clamp(y, rect.top, rect.bottom);
      const dx = x - closestX;
      const dy = y - closestY;
      return dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS;
    });
  };

  const resolveCollision = (
    nextX: number,
    nextY: number,
    prevX: number,
    prevY: number
  ) => {
    if (!collides(nextX, nextY)) {
      return { x: nextX, y: nextY };
    }
    if (!collides(nextX, prevY)) {
      return { x: nextX, y: prevY };
    }
    if (!collides(prevX, nextY)) {
      return { x: prevX, y: nextY };
    }
    return { x: prevX, y: prevY };
  };

  const handleEquipmentClick = (item: GymItem) => {
    setSelectedEquipment({
      id: item.id,
      name: item.name,
      description: item.description,
    });
    if (item.type === "teleport" && item.target) {
      const target = item.target;
      positionRef.current = { x: target.x, y: target.y };
      renderPositionRef.current = { x: target.x, y: target.y };
      localPositionRef.current = { x: target.x, y: target.y };
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

  const setKeyState = (key: "up" | "down" | "left" | "right", down: boolean) => {
    keysRef.current[key] = down;
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
    const clampedX = clamp(x, PLAYER_RADIUS, mapSize.width - PLAYER_RADIUS);
    const clampedY = clamp(y, PLAYER_RADIUS, mapSize.height - PLAYER_RADIUS);
    const resolved = resolveCollision(clampedX, clampedY, positionRef.current.x, positionRef.current.y);
    positionRef.current = resolved;
    renderPositionRef.current = resolved;
    localPositionRef.current = resolved;
    setLocalPosition(resolved);
    socketRef.current?.emit("player:move", resolved);
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
        "linear-gradient(180deg, rgba(9,13,20,0.96) 0%, rgba(4,8,14,0.98) 55%, rgba(4,10,18,0.99) 100%), repeating-linear-gradient(90deg, rgba(148,163,184,0.06) 0px, rgba(148,163,184,0.06) 1px, transparent 1px, transparent 100px), repeating-linear-gradient(0deg, rgba(148,163,184,0.05) 0px, rgba(148,163,184,0.05) 1px, transparent 1px, transparent 100px)",
    }),
    []
  );

  const gymEquipment = useMemo<GymItem[]>(
    () => [
      {
        id: "rack-1",
        type: "rack",
        x: 200,
        y: 160,
        w: 260,
        h: 120,
        name: "Power Rack Zone",
        description: "Compound lift area for squat and overhead movements.",
      },
      {
        id: "rack-2",
        type: "rack",
        x: 640,
        y: 170,
        w: 260,
        h: 120,
        name: "Power Rack Zone",
        description: "Warm up with control, then increase load progressively.",
      },
      {
        id: "bench-1",
        type: "bench",
        x: 500,
        y: 420,
        w: 220,
        h: 80,
        name: "Bench Press",
        description: "Upper-body focus zone. Track your best set today.",
      },
      {
        id: "bench-2",
        type: "bench",
        x: 980,
        y: 380,
        w: 220,
        h: 80,
        name: "Bench Zone",
        description: "Support work to improve pressing power.",
      },
      {
        id: "tread-1",
        type: "treadmill",
        x: 1500,
        y: 180,
        w: 240,
        h: 120,
        name: "Treadmill",
        description: "Light cardio to warm up and raise heart rate.",
      },
      {
        id: "tread-2",
        type: "treadmill",
        x: 1520,
        y: 330,
        w: 240,
        h: 120,
        name: "Treadmill",
        description: "Steady pace cardio block. Control your intensity.",
      },
      {
        id: "dumbbell",
        type: "dumbbell",
        x: 260,
        y: 650,
        w: 360,
        h: 80,
        name: "Dumbbell Zone",
        description: "Train with varied loads to build muscle balance.",
      },
      {
        id: "mirrors",
        type: "mirror",
        x: 1080,
        y: 120,
        w: 620,
        h: 110,
        name: "Mirror Wall",
        description: "Check your form and posture in real time.",
      },
      {
        id: "plates",
        type: "plates",
        x: 1780,
        y: 700,
        w: 160,
        h: 140,
        name: "Plate Storage",
        description: "Weight setup area for your target working set.",
      },
      {
        id: "teleport-cardio",
        type: "teleport",
        x: 1820,
        y: 260,
        w: 120,
        h: 120,
        name: "Teleport: Cardio",
        description: "Click to jump directly to the cardio zone.",
        target: { x: 320, y: 520 },
      },
      {
        id: "teleport-main",
        type: "teleport",
        x: 120,
        y: 820,
        w: 120,
        h: 120,
        name: "Teleport: Main",
        description: "Click to jump back to the main floor.",
        target: { x: 1680, y: 320 },
      },
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

  const collisionBlocks = useMemo(
    () =>
      gymEquipment
        .filter((item) => item.type !== "teleport")
        .map((item) => ({
          left: item.x,
          top: item.y,
          right: item.x + item.w,
          bottom: item.y + item.h,
        })),
    [gymEquipment]
  );

  const tabPanelAnimClass = `transform transition-all duration-200 ${tabEntering ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"}`;

  return (
    <section className="pt-28 pb-16 px-5 md:px-10 bg-gradient-to-br from-slate-950 via-gray-950 to-black min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
            Lounge
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            2D Lounge
          </h1>
          <p className="text-gray-300">
            A real-time social fitness space where you can move and chat.
          </p>
        </header>

        {loading && <div className="text-gray-300">Preparing lounge connection...</div>}
        {error && <div className="text-rose-300">{error}</div>}

        <div className="grid lg:grid-cols-[1.4fr,0.6fr] gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-300">
              <span>
                Status:{" "}
                <span
                  className={`font-semibold ${
                    connected ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {connected ? "CONNECTED" : "DISCONNECTED"}
                </span>
              </span>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  {character
                    ? `Lv.${character.level} ${character.tier} 쨌 Stage ${character.evolutionStage}`
                    : "Loading character..."}
                </span>
                <span className="text-[10px] text-white/60">
                  {pingMs !== null ? `Ping ${pingMs}ms` : "Checking ping..."}
                </span>
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    onClick={() => setZoom((prev) => clampZoom(prev - 0.1))}
                    aria-label="Zoom out"
                    className="px-2 py-1 text-[10px] font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 rounded"
                  >
                    -
                  </button>
                  <span className="text-[10px] text-white/70">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((prev) => clampZoom(prev + 0.1))}
                    aria-label="Zoom in"
                    className="px-2 py-1 text-[10px] font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 rounded"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => setShowHelp((prev) => !prev)}
                  aria-label="Toggle help"
                  className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                >
                  ?
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div
                ref={viewportRef}
                className="relative h-[78vh] w-full overflow-hidden rounded-2xl border border-white/10"
                style={mapBackground}
                onWheel={(event) => {
                  if (!event.ctrlKey) return;
                  event.preventDefault();
                  const delta = event.deltaY > 0 ? -0.05 : 0.05;
                  setZoom((prev) => clampZoom(prev + delta));
                }}
              >
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{ ...cameraStyle, width: mapSize.width, height: mapSize.height }}
                >
                  <div className="absolute inset-10 border border-emerald-400/10 rounded-3xl pointer-events-none" />
                  <div className="absolute inset-20 border border-white/5 rounded-[28px] pointer-events-none" />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-24 left-24 h-2 w-[520px] rounded-full bg-gradient-to-r from-emerald-500/40 to-transparent opacity-50" />
                    <div className="absolute top-36 left-32 h-2 w-[420px] rounded-full bg-gradient-to-r from-sky-400/40 to-transparent opacity-40" />
                    <div className="absolute bottom-24 right-32 h-2 w-[460px] rounded-full bg-gradient-to-l from-emerald-500/40 to-transparent opacity-40" />
                    <div className="zone-label" style={{ left: 220, top: 120 }}>
                      FREE WEIGHTS
                    </div>
                    <div className="zone-label" style={{ left: 1450, top: 120 }}>
                      CARDIO ZONE
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

                  {gymEquipment.map((item) => (
                    <div
                      key={item.id}
                      className={`absolute gym-${item.type} gym-interactive ${
                        selectedEquipment?.id === item.id ? "gym-selected" : ""
                      }`}
                      style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
                      onClick={() =>
                        handleEquipmentClick(item)
                      }
                    />
                  ))}

                  {renderPlayers.map((player) => {
                    const isMe = player.socketId === mySocketId;
                    const isMoving =
                      (isMe && (keysRef.current.down || keysRef.current.up || keysRef.current.left || keysRef.current.right)) ||
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
                      onTouchStart={() => setKeyState("up", true)}
                      onTouchEnd={() => setKeyState("up", false)}
                      onTouchCancel={() => setKeyState("up", false)}
                      className="ctrl-btn"
                      aria-label="Move up"
                    >
                      U
                    </button>
                    <div className="ctrl-row">
                      <button
                        onTouchStart={() => setKeyState("left", true)}
                        onTouchEnd={() => setKeyState("left", false)}
                        onTouchCancel={() => setKeyState("left", false)}
                        className="ctrl-btn"
                        aria-label="Move left"
                      >
                        L
                      </button>
                      <button
                        onTouchStart={() => setKeyState("down", true)}
                        onTouchEnd={() => setKeyState("down", false)}
                        onTouchCancel={() => setKeyState("down", false)}
                        className="ctrl-btn"
                        aria-label="Move down"
                      >
                        D
                      </button>
                      <button
                        onTouchStart={() => setKeyState("right", true)}
                        onTouchEnd={() => setKeyState("right", false)}
                        onTouchCancel={() => setKeyState("right", false)}
                        className="ctrl-btn"
                        aria-label="Move right"
                      >
                        R
                      </button>
                    </div>
                  </div>
                )}

                {!connected && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 bg-black/40">
                    Waiting for connection...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="grid grid-cols-4 gap-1 text-xs">
                {[
                  { key: "players", label: "Players" },
                  { key: "profile", label: "Profile" },
                  { key: "equipment", label: "Equipment" },
                  { key: "chat", label: "Chat" },
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
                  <h2 className="text-lg font-semibold">Players</h2>
                  <span className="text-xs text-gray-400">{players.length} online</span>
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
                            {mutedUsers[player.nickname] ? "Unmute" : "Mute"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {players.length === 0 && <div className="text-xs text-gray-400">No players connected yet.</div>}
                </div>
              </div>
            )}

            {sidebarTab === "profile" && (
              <div className={`${tabPanelAnimClass} rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Profile Card</h2>
                  {selectedPlayer && (
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="rounded text-xs text-gray-400 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    >
                      Close
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
                          Lv.{selectedPlayer.level} {selectedPlayer.tier} Stage {selectedPlayer.evolutionStage}
                        </div>
                      </div>
                    </div>
                    <div className="profile-line">
                      <span>Recent Attendance</span>
                      <span className="font-semibold text-white">{selectedPlayer.recentAttendanceCount ?? 0}</span>
                    </div>
                    <div className="profile-line">
                      <span>Active Event</span>
                      <span className="font-semibold text-white">{selectedPlayer.activeEventTitle ?? "None"}</span>
                    </div>
                    {selectedPlayer.activeEventProgress && (
                      <div className="profile-line">
                        <span>Progress</span>
                        <span className="font-semibold text-white">{selectedPlayer.activeEventProgress}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Click any avatar in the lounge to inspect details.</div>
                )}
              </div>
            )}

            {sidebarTab === "equipment" && (
              <div className={`${tabPanelAnimClass} rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Equipment Info</h2>
                  {selectedEquipment && (
                    <button
                      onClick={() => setSelectedEquipment(null)}
                      className="rounded text-xs text-gray-400 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    >
                      Close
                    </button>
                  )}
                </div>
                {selectedEquipment ? (
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="font-semibold text-white">{selectedEquipment.name}</div>
                    <p className="text-gray-300">{selectedEquipment.description}</p>
                    <div className="text-xs text-gray-500">Click an item again to highlight it.</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Click equipment on the map to see its details.</div>
                )}
              </div>
            )}

            {sidebarTab === "chat" && (
              <div className={`${tabPanelAnimClass} flex h-[35vh] flex-col rounded-2xl border border-white/10 bg-white/5 p-4`}>
                <h2 className="mb-3 text-lg font-semibold">Live Chat</h2>
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
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">SYSTEM</span>
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
                            {mutedUsers[msg.nickname] ? "Unmute" : "Mute"}
                          </button>
                          <button
                            onClick={() => alert(`Report submitted: ${msg.nickname}`)}
                            className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                          >
                            Report
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {chatRows.length === 0 && <div className="text-xs text-gray-400">Start the conversation.</div>}
                  <div ref={chatEndRef} />
                </div>
                {typingNames.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    {typingNames.slice(0, 3).join(", ")}
                    {typingNames.length > 3 ? " and others" : ""} typing...
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label="Chat message input"
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
                    placeholder="Type a message (max 200 chars)"
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!connected}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
                  >
                    Send
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
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Lounge Guide</p>
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
                  Back
                </button>
                {onboardingStep < onboardingSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep((prev) => Math.min(onboardingSteps.length - 1, prev + 1))}
                    className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black"
                  >
                    Next
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
                    Start
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
            <div className="help-title">Lounge Controls</div>
            <ul className="help-list">
              <li>Move with `WASD`, arrow keys, or gamepad stick.</li>
              <li>Zoom with `Ctrl + Mouse Wheel` or top +/- buttons.</li>
              <li>Send chat with Enter and see typing indicators in real time.</li>
              <li>Click equipment to view details, and use teleport pads to jump zones.</li>
              <li>Mute or report users from player list and chat panel.</li>
            </ul>
            <button className="help-close" onClick={() => setShowHelp(false)}>
              Close
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

