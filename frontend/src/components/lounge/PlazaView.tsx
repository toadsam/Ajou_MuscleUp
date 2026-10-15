import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { createPlaza, EMOTES, PLAZA_ZONES, type EmoteKind, type PlazaController, type PlazaPlayer, type PlazaZone } from "./plaza";

export type { EmoteKind };

// 득근 광장 화면(세로 화면 그대로) — 위: 방 이름 · 인원 / 가운데: 광장 지도(누르면 걸어감) / 아래: 대화 · 이모트 · 입력.
// 실시간 연결은 부모가 맡는다(Lounge.tsx). 이 화면은 받은 사람 · 대화를 그리고, 내 이동 · 말을 콜백으로 올린다.

export type PlazaMessage = { id: string; playerId: string | null; name: string; text: string; mine?: boolean };
export type PlazaEmote = { id: string; playerId: string; kind: EmoteKind };
export type PlazaPlayerInfo = PlazaPlayer & { title?: string | null; tier?: string | null };

/** 장소에 서면 뜨는 짧은 안내 + 행동 */
const ZONE_CARD: Record<PlazaZone, { body: string; to?: string; cta?: string }> = {
  board: { body: "동아리 공지와 이벤트가 붙어 있어요.", to: "/events", cta: "이벤트 보기" },
  podium: { body: "이번 주 출석 · 운동 랭킹 1 · 2 · 3등이 서는 곳이에요.", to: "/rankings", cta: "랭킹 보기" },
  vending: { body: "단백질은 같이 사면 싸요. 공동구매를 열거나 참여해 보세요.", to: "/protein", cta: "공동구매 보기" },
  fountain: { body: "원판 분수. 광장 한가운데예요. 여기서 만나요!" },
  workout: { body: "철봉 · 평행봉. 매달리면 다른 사람에게도 보여요." },
};

type Props = {
  roomName: string;
  me: Omit<PlazaPlayer, "x" | "y">;
  players: PlazaPlayerInfo[];
  messages: PlazaMessage[];
  emotes: PlazaEmote[];
  status?: ReactNode;
  /** 처음 설 자리(월드 픽셀) */
  start?: [number, number];
  onMove: (x: number, y: number) => void;
  onSend: (text: string) => void;
  onEmote: (kind: EmoteKind) => void;
  /** 다른 사람을 눌렀을 때 아래 칸에 더 보일 행동(친구 신청 등) */
  playerActions?: (p: PlazaPlayerInfo) => ReactNode;
  /** 펼친 대화창에서 남의 말 신고 */
  onReport?: (m: PlazaMessage) => void;
  /** 장소 카드에 더 보일 것(운동기구 앞 "지금 운동 중" 등) */
  zoneExtra?: Partial<Record<PlazaZone, ReactNode>>;
};

export default function PlazaView(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<PlazaController | null>(null);
  const shownMsg = useRef(new Set<string>());
  const shownEmote = useRef(new Set<string>());
  const cbRef = useRef({ onMove: p.onMove });
  const [zone, setZone] = useState<PlazaZone | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    cbRef.current = { onMove: p.onMove };
  });

  // 엔진은 한 번만 만든다(내 정보가 바뀌어도 이어서)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    ctl.current = createPlaza(c, p.me, {
      onMove: (x, y) => cbRef.current.onMove(x, y),
      onTapPlayer: (id) => setPicked(id),
      onZone: (z) => {
        setZone(z);
        if (z) setPicked(null);
      },
    }, p.start);
    return () => ctl.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.me.id]);

  useEffect(() => {
    ctl.current?.setPlayers(p.players);
  }, [p.players]);

  // 새 대화 · 이모트는 그 사람 머리 위 말풍선으로
  useEffect(() => {
    for (const m of p.messages) {
      if (shownMsg.current.has(m.id)) continue;
      shownMsg.current.add(m.id);
      if (m.playerId) ctl.current?.say(m.playerId, m.text);
    }
  }, [p.messages]);
  useEffect(() => {
    for (const e of p.emotes) {
      if (shownEmote.current.has(e.id)) continue;
      shownEmote.current.add(e.id);
      ctl.current?.say(e.playerId, EMOTES.find((x) => x.kind === e.kind)?.say ?? "!", "emote");
    }
  }, [p.emotes]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    p.onSend(t);
    setText("");
  };

  const pickedPlayer = picked ? p.players.find((x) => x.id === picked) ?? null : null;
  const recent = p.messages.slice(logOpen ? -30 : -3);
  const card = zone ? ZONE_CARD[zone] : null;

  return (
    <section className="flex h-[100dvh] flex-col bg-steel-950 pt-[68px] text-white">
      <div className="flex items-center justify-between gap-2 border-b-2 border-black bg-steel-900 px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl leading-tight">{p.roomName}</h1>
          <p className="text-xs text-steel-400">
            <span className="font-num text-sm text-plate-green">{p.players.length + 1}</span>명 · 바닥을 누르면 걸어가요
          </p>
        </div>
        {p.status}
      </div>

      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="득근 광장 지도. 바닥을 누르면 그 자리로 걸어가요." />

        {/* 장소에 서면: 짧은 안내 */}
        {card && zone && !pickedPlayer && (
          <div className="dg-steel dg-rise absolute inset-x-3 bottom-3 max-h-[60%] overflow-y-auto p-3 text-sm">
            <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base text-plate-yellow">{PLAZA_ZONES[zone].name}</p>
              <p className="text-steel-300">{card.body}</p>
            </div>
            {card.to && (
              <Link to={card.to} className="dg-btn dg-btn-primary min-h-[40px] flex-none px-3 text-xs">
                {card.cta}
              </Link>
            )}
            {zone === "workout" && (
              <button type="button" onClick={() => p.onEmote("cheer")} className="dg-btn dg-btn-primary min-h-[40px] flex-none px-3 text-xs">
                철봉 매달리기
              </button>
            )}
            </div>
            {p.zoneExtra?.[zone] && <div className="mt-3">{p.zoneExtra[zone]}</div>}
          </div>
        )}

        {/* 다른 사람을 누르면: 이름표 카드 */}
        {pickedPlayer && (
          <div className="dg-steel dg-rise absolute inset-x-3 bottom-3 space-y-2 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-lg">{pickedPlayer.name}</p>
                <p className="text-xs text-steel-400">
                  {pickedPlayer.level ? `Lv.${pickedPlayer.level}` : ""}
                  {pickedPlayer.title ? ` · ${pickedPlayer.title}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="text-xs text-steel-400 underline underline-offset-4">
                닫기
              </button>
            </div>
            <div className="flex flex-wrap gap-2">{p.playerActions?.(pickedPlayer)}</div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-black bg-steel-900 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2" data-fab-avoid>
        <div className="flex items-start gap-2">
          <div className={`min-w-0 flex-1 space-y-0.5 overflow-y-auto text-sm ${logOpen ? "max-h-[40vh]" : "max-h-[66px]"}`} aria-live="polite">
            {recent.length === 0 ? (
              <p className="text-xs text-steel-500">아직 대화가 없어요. 먼저 인사해 보세요!</p>
            ) : (
              recent.map((m) => (
                <p key={m.id} className={logOpen ? "break-words" : "truncate"}>
                  {m.playerId ? <b className={m.mine ? "text-plate-yellow" : "text-steel-200"}>{m.name}</b> : <b className="text-plate-green">알림</b>}{" "}
                  <span className="text-steel-300">{m.text}</span>
                  {logOpen && !m.mine && m.playerId && p.onReport && (
                    <button type="button" onClick={() => p.onReport?.(m)} className="ml-1 text-xs text-steel-500 underline underline-offset-2">
                      신고
                    </button>
                  )}
                </p>
              ))
            )}
          </div>
          <button type="button" onClick={() => setLogOpen((v) => !v)} aria-expanded={logOpen} className="flex-none text-xs text-steel-400 underline underline-offset-4">
            {logOpen ? "접기" : "대화 더 보기"}
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          {EMOTES.map((e) => (
            <button key={e.kind} type="button" onClick={() => p.onEmote(e.kind)} className="dg-btn dg-btn-steel min-h-[34px] flex-1 px-1 text-xs">
              {e.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="광장에 한마디"
            aria-label="채팅 입력"
            className="dg-well min-h-[42px] min-w-0 flex-1 px-3 text-white"
          />
          <button type="submit" disabled={!text.trim()} className="dg-btn dg-btn-primary min-h-[42px] px-4">
            보내기
          </button>
        </form>
      </div>
    </section>
  );
}
