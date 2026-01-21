import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import PlayerAvatar from "../components/PlayerAvatar";

type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

type CharacterResponse = {
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
};

type PlayerState = {
  socketId: string;
  userId?: string;
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
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

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";

const DEFAULT_MAP = { width: 1200, height: 700 };
const MOVE_SPEED = 240;
const MOVE_EMIT_MS = 80;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parseCharacter = (payload: any): CharacterResponse | null => {
  if (!payload) return null;
  const raw = payload.character ?? payload;
  if (!raw) return null;
  return {
    level: Number(raw.level ?? 1),
    tier: (raw.tier ?? "BRONZE") as CharacterTier,
    evolutionStage: Number(raw.evolutionStage ?? 0),
  };
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
  const [position, setPosition] = useState({ x: 200, y: 200 });

  const socketRef = useRef<Socket | null>(null);
  const positionRef = useRef(position);
  const lastEmitRef = useRef(0);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
        const url = API_BASE ? `${API_BASE}/api/character/me` : "/api/character/me";
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "캐릭터 정보를 불러오지 못했습니다.");
        }
        const payload = await res.json();
        const parsed = parseCharacter(payload);
        if (!parsed) {
          throw new Error("캐릭터 정보 형식이 올바르지 않습니다.");
        }
        setCharacter(parsed);
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
      const me = nextPlayers.find((player) => player.socketId === socket.id);
      if (me) {
        positionRef.current = { x: me.x, y: me.y };
        setPosition({ x: me.x, y: me.y });
      }
    });

    socket.on("chat:message", (payload: ChatMessage) => {
      setMessages((prev) => [...prev, payload].slice(-120));
    });

    socket.on("lounge:error", (payload) => {
      setError(payload?.message ?? "라운지 연결에 실패했습니다.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, character]);

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
    if (!connected) return;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const dirX =
        (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      const dirY =
        (keysRef.current.down ? 1 : 0) - (keysRef.current.up ? 1 : 0);

      if (dirX !== 0 || dirY !== 0) {
        const length = Math.hypot(dirX, dirY) || 1;
        const vx = (dirX / length) * MOVE_SPEED;
        const vy = (dirY / length) * MOVE_SPEED;
        const nextX = clamp(
          positionRef.current.x + vx * dt,
          0,
          mapSize.width
        );
        const nextY = clamp(
          positionRef.current.y + vy * dt,
          0,
          mapSize.height
        );
        if (
          nextX !== positionRef.current.x ||
          nextY !== positionRef.current.y
        ) {
          positionRef.current = { x: nextX, y: nextY };
          setPosition({ x: nextX, y: nextY });
          const nowMs = performance.now();
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

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.nickname.localeCompare(b.nickname));
  }, [players]);

  const handleChatSend = () => {
    const message = chatInput.trim();
    if (!message || message.length > 200) return;
    socketRef.current?.emit("chat:send", { message });
    setChatInput("");
  };

  const mapStyle = useMemo(() => {
    const toPercent = (value: number, max: number) =>
      `${(value / max) * 100}%`;
    return { toPercent };
  }, []);

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
              <span className="text-xs text-gray-400">
                {character
                  ? `Lv.${character.level} ${character.tier} · Stage ${character.evolutionStage}`
                  : "캐릭터 로딩 중"}
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div className="relative h-[70vh] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_55%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.95))] border border-white/10">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-6 border border-emerald-400/10 rounded-2xl" />
                  <div className="absolute inset-12 border border-white/5 rounded-2xl" />
                </div>

                {players.map((player) => (
                  <div
                    key={player.socketId}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: mapStyle.toPercent(player.x, mapSize.width),
                      top: mapStyle.toPercent(player.y, mapSize.height),
                    }}
                  >
                    <PlayerAvatar
                      nickname={player.nickname}
                      level={player.level}
                      tier={player.tier}
                      isMe={player.socketId === mySocketId}
                    />
                  </div>
                ))}

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
                    <div className="text-xs text-gray-300">
                      Lv.{player.level} · {player.tier}
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col h-[35vh]">
              <h2 className="text-lg font-semibold mb-3">전체 채팅</h2>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 text-sm">
                {messages.map((msg, idx) => (
                  <div key={`${msg.ts}-${idx}`} className="text-gray-200">
                    <span className="text-emerald-300 font-semibold">
                      {msg.nickname}
                    </span>
                    <span className="text-gray-500 mx-2">·</span>
                    <span>{msg.message}</span>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-xs text-gray-400">
                    첫 메시지를 남겨보세요.
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleChatSend();
                    }
                  }}
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
    </section>
  );
}
