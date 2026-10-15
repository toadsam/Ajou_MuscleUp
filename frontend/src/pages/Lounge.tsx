import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import LiveZone from "../components/lounge/LiveZone";
import PlazaView, { type EmoteKind, type PlazaEmote, type PlazaMessage, type PlazaPlayerInfo } from "../components/lounge/PlazaView";
import { REALTIME_URL, realtimeAuthFor, realtimeConnectError, type LoungeRoom } from "../lib/realtime";
import { useCurrentGym, useMyGyms } from "../lib/currentGym";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";

// 라운지 "득근 광장"(2026-10-16): 위에서 내려다보는 광장에서 바닥을 누르면 걸어간다(홈 지도와 같은 조작).
// 예전의 옆 보기 점프 라운지(중력 · 사다리 · 방향키 · 가로 화면 · 보이스 · 스티커 · 따라가기)는 사용자 요청으로 바꿨다.
// 실시간 서버(realtime/)와 주고받는 것: 입장권(auth) → lounge:join → lounge:welcome · lounge:players(입장 · 퇴장) ·
// lounge:moves(100ms 묶음) · chat:message · social:emote. 내 이동은 player:move, 말은 chat:send, 이모트는 social:emote.
// 방은 입장권의 room 으로만 정해진다(광장 square · 모임 gym:{slug}, 백엔드가 멤버 확인).

type ServerPlayer = {
  socketId: string;
  id: string;
  nickname: string;
  level: number;
  tier?: string;
  mbti?: string;
  tank?: string;
  title?: string;
  x: number;
  y: number;
};

type ChatPayload = { fromSocketId?: string; nickname: string; message: string; ts: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const MUTED_KEY = "lounge_muted_users_v1";
const MAX_MESSAGES = 80;

const toInfo = (p: ServerPlayer): PlazaPlayerInfo => ({
  id: p.socketId,
  name: p.nickname,
  level: p.level,
  mbti: p.mbti ?? null,
  tank: p.tank ?? null,
  title: p.title ?? null,
  tier: p.tier ?? null,
  x: p.x,
  y: p.y,
});

function loadMuted(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(MUTED_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export default function Lounge() {
  // 라운지 방: 헤더에서 고른 모임이 라운지를 쓰면 그 모임 방(기본), 아니면 광장. 방을 바꾸면 새 입장권으로 다시 붙는다
  const [currentGymSlug] = useCurrentGym();
  const { gyms: myGyms } = useMyGyms();
  const loungeGym = myGyms.find((g) => g.slug === currentGymSlug && g.status === "ACTIVE" && g.features.includes("LOUNGE")) ?? null;
  const [preferSquare, setPreferSquare] = useState(false);
  const loungeRoom: LoungeRoom = loungeGym && !preferSquare ? `gym:${loungeGym.slug}` : "square";

  const socketRef = useRef<Socket | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const seq = useRef(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("득근 광장");
  const [myId, setMyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<ServerPlayer[]>([]);
  const [messages, setMessages] = useState<(PlazaMessage & { ts: string })[]>([]);
  const [emotes, setEmotes] = useState<PlazaEmote[]>([]);
  const [muted, setMuted] = useState<Record<string, boolean>>(() => loadMuted());
  const reported = useRef(new Set<string>());

  useEffect(() => {
    try {
      localStorage.setItem(MUTED_KEY, JSON.stringify(muted));
    } catch {
      // 저장 못 해도 이번 화면에서는 반영됨
    }
  }, [muted]);

  useEffect(() => {
    if (!REALTIME_URL) {
      setError("라운지 실시간 기능을 지금은 쓸 수 없어요. 잠시 뒤에 다시 들어와 주세요.");
      return;
    }
    setPlayers([]);
    setMyId(null);
    setMessages([]);
    // 입장권(auth)에 담긴 이름 · 레벨 · 티어 · 민소매 · 칭호를 서버가 쓴다. 클라이언트가 보낸 값은 믿지 않는다.
    const socket = io(REALTIME_URL, { transports: ["websocket"], auth: realtimeAuthFor(loungeRoom) });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      // 닉네임은 개발 서버의 손님 입장(입장권 없음)에서만 쓰인다. 운영은 입장권 값만 쓴다.
      let nickname: string | undefined;
      try {
        nickname = (JSON.parse(localStorage.getItem("user") || "{}") as { nickname?: string }).nickname;
      } catch {
        nickname = undefined;
      }
      socket.emit("lounge:join", { nickname });
    });
    socket.on("connect_error", (err) => setError(realtimeConnectError(err)));
    socket.on("disconnect", () => setConnected(false));
    socket.on("lounge:welcome", (payload: { roomName?: string; room?: string }) => {
      setRoomName(payload?.room && payload.room !== "square" ? (payload.roomName ?? "모임 방") : "득근 광장");
      setMyId(socket.id ?? null);
      // 다시 붙었으면 있던 자리를 알려 준다(서버는 새로 들어온 사람을 입구에 세운다)
      if (lastPos.current) socket.emit("player:move", lastPos.current);
    });
    // 전체 목록은 입장 · 퇴장 때만, 위치는 움직인 사람만 100ms 마다 묶어서 온다
    socket.on("lounge:players", (payload: { players?: ServerPlayer[] }) => setPlayers(payload?.players ?? []));
    socket.on("lounge:moves", (payload: { moves?: { socketId: string; x: number; y: number }[] }) => {
      const moves = payload?.moves;
      if (!Array.isArray(moves) || !moves.length) return;
      const byId = new Map(moves.map((m) => [m.socketId, m]));
      setPlayers((list) =>
        list.map((p) => {
          const m = byId.get(p.socketId);
          return m && Number.isFinite(m.x) && Number.isFinite(m.y) ? { ...p, x: m.x, y: m.y } : p;
        }),
      );
    });
    socket.on("chat:message", (p: ChatPayload) => {
      if (!p?.message) return;
      seq.current += 1;
      setMessages((list) =>
        [
          ...list,
          {
            id: `c${seq.current}`,
            playerId: p.fromSocketId ?? null,
            name: p.nickname,
            text: p.message,
            mine: p.fromSocketId === socket.id,
            ts: p.ts,
          },
        ].slice(-MAX_MESSAGES),
      );
    });
    socket.on("social:emote", (p: { fromSocketId: string; emote: string }) => {
      if (!p?.fromSocketId) return;
      seq.current += 1;
      setEmotes((list) => [...list, { id: `e${seq.current}`, playerId: p.fromSocketId, kind: p.emote as EmoteKind }].slice(-40));
    });
    socket.on("lounge:error", () => setError("라운지에 들어가지 못했어요. 새로고침해 주세요."));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loungeRoom]);

  const me = useMemo(() => players.find((p) => p.socketId === myId) ?? null, [players, myId]);
  const others = useMemo(() => players.filter((p) => p.socketId !== myId).map(toInfo), [players, myId]);
  // 숨긴 사람의 말은 대화창 · 말풍선 모두에서 뺀다
  const shownMessages = useMemo(() => messages.filter((m) => m.mine || !muted[m.name]), [messages, muted]);

  const onMove = useCallback((x: number, y: number) => {
    lastPos.current = { x, y };
    socketRef.current?.emit("player:move", { x, y });
  }, []);

  const reportMessage = async (m: PlazaMessage & { ts: string }) => {
    const key = `${m.name}|${m.ts}|${m.text}`;
    if (reported.current.has(key)) {
      toast("이미 신고한 메시지예요.");
      return;
    }
    if (!window.confirm(`${m.name}님의 메시지를 운영진에게 신고할까요?`)) return;
    try {
      // 채팅 신고는 문의(운영진이 관리자 화면에서 확인)로 접수한다
      const res = await fetch(`${API_BASE}/api/support/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: me?.nickname || "익명",
          email: null,
          message: `라운지 채팅 신고\n대상: ${m.name}\n메시지: ${m.text.slice(0, 600)}\n보낸 시각: ${m.ts}`,
          page: "/lounge",
        }),
      });
      if (!res.ok) throw await httpError(res, "신고를 보내지 못했어요.");
      reported.current.add(key);
      toast("신고를 접수했어요. 운영진이 확인할게요.", "success");
    } catch (err) {
      toast(friendlyError(err, "신고를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요."), "error");
    }
  };

  const status = (
    <div className="flex flex-none items-center gap-1.5">
      {loungeGym && (
        <div className="flex gap-1" role="group" aria-label="라운지 방 고르기">
          <button
            type="button"
            onClick={() => setPreferSquare(true)}
            aria-pressed={loungeRoom === "square"}
            className={`dg-btn min-h-[32px] px-2 text-xs ${loungeRoom === "square" ? "dg-btn-primary" : "dg-btn-steel"}`}
          >
            광장
          </button>
          <button
            type="button"
            onClick={() => setPreferSquare(false)}
            aria-pressed={loungeRoom !== "square"}
            className={`dg-btn min-h-[32px] max-w-[7rem] truncate px-2 text-xs ${loungeRoom !== "square" ? "dg-btn-primary" : "dg-btn-steel"}`}
          >
            {loungeGym.name}
          </button>
        </div>
      )}
      <span className={`dg-chip ${connected ? "bg-plate-green text-black" : "bg-steel-700 text-steel-200"}`}>{connected ? "연결됨" : "연결 중"}</span>
    </div>
  );

  if (error && !me) {
    return (
      <section className="min-h-screen px-4 pb-28 pt-28 text-white">
        <div className="dg-steel mx-auto max-w-md space-y-3 p-5 text-sm">
          <p className="font-semibold text-red-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="dg-btn dg-btn-steel min-h-[40px] px-4">
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  if (!me) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 pt-20 text-sm text-steel-300" role="status">
        <span className="inline-flex items-center gap-3">
          <span className="dg-loading-plates" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          광장에 들어가는 중
        </span>
      </section>
    );
  }

  return (
    <PlazaView
      key={me.socketId}
      roomName={roomName}
      me={{ id: me.socketId, name: me.nickname, level: me.level, mbti: me.mbti ?? null, tank: me.tank ?? null }}
      start={lastPos.current ? [lastPos.current.x, lastPos.current.y] : undefined}
      players={others}
      messages={shownMessages}
      emotes={emotes}
      status={status}
      onMove={onMove}
      onSend={(text) => socketRef.current?.emit("chat:send", { message: text })}
      onEmote={(kind) => socketRef.current?.emit("social:emote", { emote: kind })}
      onReport={(m) => void reportMessage(m as PlazaMessage & { ts: string })}
      zoneExtra={{ workout: <LiveZone /> }}
      playerActions={(p) => (
        <>
          <button type="button" onClick={() => socketRef.current?.emit("social:emote", { emote: "cheer" })} className="dg-btn dg-btn-primary min-h-[36px] px-3 text-xs">
            응원 보내기
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => ({ ...m, [p.name]: !m[p.name] }))}
            aria-pressed={Boolean(muted[p.name])}
            className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs"
          >
            {muted[p.name] ? "대화 다시 보기" : "대화 숨기기"}
          </button>
        </>
      )}
    />
  );
}
