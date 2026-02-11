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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
      setError("세션 정보가 올바르지 않습니다.");
      setLoading(false);
    }
  }, []);

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
          throw new Error(text || "캐릭터 정보를 불러오지 못했습니다.");
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
        setError(err?.message ?? "캐릭터 정보를 불러오지 못했습니다.");
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
      setPlayers(nextPlayers);
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
      setError(payload?.message ?? "라운지 연결에 실패했습니다.");
    });

    return () => {
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
    const banned = ["욕설", "비속어"];
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
        name: "파워랙 존",
        description: "스쿼트/벤치/오버헤드 프레스를 위한 핵심 구역.",
      },
      {
        id: "rack-2",
        type: "rack",
        x: 640,
        y: 170,
        w: 260,
        h: 120,
        name: "파워랙 존",
        description: "바벨을 안전하게 세팅하고 고중량 훈련 가능.",
      },
      {
        id: "bench-1",
        type: "bench",
        x: 500,
        y: 420,
        w: 220,
        h: 80,
        name: "벤치 프레스",
        description: "가슴/삼두 집중 구간. 오늘 기록을 체크해봐.",
      },
      {
        id: "bench-2",
        type: "bench",
        x: 980,
        y: 380,
        w: 220,
        h: 80,
        name: "벤치 존",
        description: "상체 파워 향상을 위한 핵심 운동.",
      },
      {
        id: "tread-1",
        type: "treadmill",
        x: 1500,
        y: 180,
        w: 240,
        h: 120,
        name: "러닝머신",
        description: "가볍게 워밍업하고 심박을 올려보자.",
      },
      {
        id: "tread-2",
        type: "treadmill",
        x: 1520,
        y: 330,
        w: 240,
        h: 120,
        name: "러닝머신",
        description: "유산소 구간, 페이스 조절 필수.",
      },
      {
        id: "dumbbell",
        type: "dumbbell",
        x: 260,
        y: 650,
        w: 360,
        h: 80,
        name: "덤벨 존",
        description: "다양한 각도로 근육을 자극하는 공간.",
      },
      {
        id: "mirrors",
        type: "mirror",
        x: 1080,
        y: 120,
        w: 620,
        h: 110,
        name: "미러 월",
        description: "폼 체크 필수! 자세를 확인하자.",
      },
      {
        id: "plates",
        type: "plates",
        x: 1780,
        y: 700,
        w: 160,
        h: 140,
        name: "플레이트 존",
        description: "중량 세팅 구역. 오늘 목표 중량은?",
      },
      {
        id: "teleport-cardio",
        type: "teleport",
        x: 1820,
        y: 260,
        w: 120,
        h: 120,
        name: "텔레포트: 유산소존",
        description: "클릭 시 메인 프리웨이트 존으로 이동합니다.",
        target: { x: 320, y: 520 },
      },
      {
        id: "teleport-main",
        type: "teleport",
        x: 120,
        y: 820,
        w: 120,
        h: 120,
        name: "텔레포트: 프리웨이트",
        description: "클릭 시 유산소 존으로 이동합니다.",
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

  return (
    <section className="pt-28 pb-16 px-5 md:px-10 bg-gradient-to-br from-slate-950 via-gray-950 to-black min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
            Lounge
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            2D 라운지
          </h1>
          <p className="text-gray-300">
            이동하며 대화할 수 있는 실시간 소셜 공간입니다.
          </p>
        </header>

        {loading && <div className="text-gray-300">연결 준비 중...</div>}
        {error && <div className="text-rose-300">{error}</div>}

        <div className="grid lg:grid-cols-[1.4fr,0.6fr] gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-300">
              <span>
                상태:{" "}
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
                    ? `Lv.${character.level} ${character.tier} · Stage ${character.evolutionStage}`
                    : "캐릭터 로딩 중"}
                </span>
                <span className="text-[10px] text-white/60">
                  {pingMs !== null ? `핑 ${pingMs}ms` : "핑 측정중"}
                </span>
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    onClick={() => setZoom((prev) => clampZoom(prev - 0.1))}
                    className="px-2 py-1 text-[10px] font-semibold text-white/80 hover:text-white"
                  >
                    -
                  </button>
                  <span className="text-[10px] text-white/70">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((prev) => clampZoom(prev + 0.1))}
                    className="px-2 py-1 text-[10px] font-semibold text-white/80 hover:text-white"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => setShowHelp((prev) => !prev)}
                  className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:text-white"
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
                            {player.nickname} · Lv.{player.level} · {player.tier} · S{player.evolutionStage}
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
                </div>

                <div className="minimap">
                  <div className="minimap-inner">
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
                  </div>
                </div>

                {isMobile && (
                  <div className="mobile-controls">
                    <button
                      onTouchStart={() => setKeyState("up", true)}
                      onTouchEnd={() => setKeyState("up", false)}
                      className="ctrl-btn"
                    >
                      ▲
                    </button>
                    <div className="ctrl-row">
                      <button
                        onTouchStart={() => setKeyState("left", true)}
                        onTouchEnd={() => setKeyState("left", false)}
                        className="ctrl-btn"
                      >
                        ◀
                      </button>
                      <button
                        onTouchStart={() => setKeyState("down", true)}
                        onTouchEnd={() => setKeyState("down", false)}
                        className="ctrl-btn"
                      >
                        ▼
                      </button>
                      <button
                        onTouchStart={() => setKeyState("right", true)}
                        onTouchEnd={() => setKeyState("right", false)}
                        className="ctrl-btn"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                )}

                {!connected && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 bg-black/40">
                    연결을 기다리는 중입니다...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">접속자</h2>
                <span className="text-xs text-gray-400">
                  {players.length}명 접속 중
                </span>
              </div>
              <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                {sortedPlayers.map((player) => (
                  <div
                    key={`list-${player.socketId}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                      player.socketId === mySocketId
                        ? "bg-emerald-500/20 border border-emerald-400/40"
                        : "bg-white/5 border border-white/5"
                    }`}
                  >
                    <div className="font-semibold">{player.nickname}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <span>
                        Lv.{player.level} · {player.tier}
                      </span>
                      {player.socketId !== mySocketId && (
                        <button
                          onClick={() => toggleMute(player.nickname)}
                          className="text-[10px] text-gray-400 hover:text-white"
                        >
                          {mutedUsers[player.nickname] ? "언뮤트" : "뮤트"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {players.length === 0 && (
                  <div className="text-xs text-gray-400">
                    아직 접속자가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">프로필 카드</h2>
                {selectedPlayer && (
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-xs text-gray-400 hover:text-gray-200"
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
                      <div className="text-white font-semibold">{selectedPlayer.nickname}</div>
                      <div className="text-xs text-gray-400">
                        Lv.{selectedPlayer.level} · {selectedPlayer.tier} · Stage {selectedPlayer.evolutionStage}
                      </div>
                    </div>
                  </div>
                  <div className="profile-line">
                    <span>최근 출석</span>
                    <span className="text-white font-semibold">
                      {selectedPlayer.recentAttendanceCount ?? 0}회
                    </span>
                  </div>
                  <div className="profile-line">
                    <span>참여 이벤트</span>
                    <span className="text-white font-semibold">
                      {selectedPlayer.activeEventTitle ?? "없음"}
                    </span>
                  </div>
                  {selectedPlayer.activeEventProgress && (
                    <div className="profile-line">
                      <span>진행률</span>
                      <span className="text-white font-semibold">{selectedPlayer.activeEventProgress}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-400">
                  라운지에서 캐릭터를 클릭하면 상세 정보가 표시됩니다.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">장비 정보</h2>
                {selectedEquipment && (
                  <button
                    onClick={() => setSelectedEquipment(null)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    닫기
                  </button>
                )}
              </div>
              {selectedEquipment ? (
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="text-white font-semibold">{selectedEquipment.name}</div>
                  <p className="text-gray-300">{selectedEquipment.description}</p>
                  <div className="text-xs text-gray-500">장비를 다시 클릭하면 강조됩니다.</div>
                </div>
              ) : (
                <div className="text-sm text-gray-400">
                  맵의 기구를 클릭하면 설명이 표시됩니다.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col h-[35vh]">
              <h2 className="text-lg font-semibold mb-3">전체 채팅</h2>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 text-sm">
                {messages
                  .filter((msg) => !mutedUsers[msg.nickname])
                  .map((msg, idx) => (
                    <div key={`${msg.ts}-${idx}`} className="text-gray-200 flex items-start gap-2">
                      <div>
                        <span className="text-emerald-300 font-semibold">
                          {msg.nickname}
                        </span>
                        <span className="text-gray-500 mx-2">·</span>
                        <span>{filterMessage(msg.message)}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-400">
                        <button
                          onClick={() => toggleMute(msg.nickname)}
                          className="hover:text-white"
                        >
                          {mutedUsers[msg.nickname] ? "언뮤트" : "뮤트"}
                        </button>
                        <button
                          onClick={() => alert(`신고가 접수되었습니다: ${msg.nickname}`)}
                          className="hover:text-white"
                        >
                          신고
                        </button>
                      </div>
                    </div>
                  ))}
                {messages.length === 0 && (
                  <div className="text-xs text-gray-400">
                    첫 메시지를 남겨보세요.
                  </div>
                )}
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
                  className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
                <button
                  onClick={handleChatSend}
                  disabled={!connected}
                  className="px-4 py-2 rounded-xl bg-emerald-400 text-black text-sm font-semibold hover:bg-emerald-300 transition disabled:opacity-60"
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="help-overlay">
          <div className="help-card">
            <div className="help-title">라운지 조작 가이드</div>
            <ul className="help-list">
              <li>이동: WASD / 방향키 / 게임패드 왼쪽 스틱</li>
              <li>줌: 상단 +/- 버튼 또는 Ctrl + 휠</li>
              <li>채팅: Enter로 전송, 말풍선 자동 표시</li>
              <li>장비: 클릭 시 설명 표시, 텔레포트 장비 클릭 시 이동</li>
              <li>뮤트: 접속자/채팅 목록에서 토글</li>
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
