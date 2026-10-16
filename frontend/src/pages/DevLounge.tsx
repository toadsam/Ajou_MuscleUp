import { useEffect, useRef, useState } from "react";
import PlazaView, { type EmoteKind, type PlazaEmote, type PlazaMessage, type PlazaPlayerInfo } from "../components/lounge/PlazaView";
import { EMOTES, TILE, plazaThemeOf, walkable } from "../components/lounge/plaza";

// 개발 서버 전용(/dev/lounge): 득근 광장 시안 — 실시간 서버 없이 가짜 사람들이 걸어 다니고 말한다.

const ME = { id: "me", name: "나", level: 12, mbti: "ESTP" };
const BOTS: PlazaPlayerInfo[] = [
  { id: "b1", name: "스쿼트왕", level: 31, mbti: "ENTJ", title: "새벽 출석러", x: 14 * TILE + 8, y: 9 * TILE + 12 },
  { id: "b2", name: "단백질요정", level: 18, mbti: "INFP", title: "식단 기록왕", x: 8 * TILE + 8, y: 18 * TILE + 12 },
  { id: "b3", name: "러닝크루", level: 24, mbti: "ISFJ", x: 19 * TILE + 8, y: 22 * TILE + 12 },
  { id: "b4", name: "철봉마스터", level: 40, mbti: "ESTP", title: "3대 400", x: 23 * TILE + 8, y: 15 * TILE + 12 },
  { id: "b5", name: "헬린이", level: 3, mbti: "ENFP", x: 6 * TILE + 8, y: 12 * TILE + 12 },
  { id: "b6", name: "아주대불꽃", level: 15, mbti: "INTJ", x: 12 * TILE + 8, y: 26 * TILE + 12 },
];
const LINES = ["오늘 하체 날이에요", "다들 출석했어요?", "분수 앞에서 봐요!", "벤치 PR 갱신했어요", "단백질 공구 열렸대요", "러닝 5km 뛰고 왔어요"];

export default function DevLounge() {
  // ?at=칸,줄 — 시안 캡처용 시작 자리
  const [start] = useState<[number, number] | undefined>(() => {
    const m = new URLSearchParams(window.location.search).get("at")?.match(/^(\d+),(\d+)$/);
    return m ? [Number(m[1]) * TILE + 8, Number(m[2]) * TILE + 12] : undefined;
  });
  // ?theme=GYM · TRACK · NIGHT · BLOSSOM, ?title=모임 이름 — 모임 방 모습 시안
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const [players, setPlayers] = useState<PlazaPlayerInfo[]>(BOTS);
  const [messages, setMessages] = useState<PlazaMessage[]>([
    { id: "m0", playerId: null, name: "알림", text: "득근 광장에 오신 걸 환영해요." },
  ]);
  const [emotes, setEmotes] = useState<PlazaEmote[]>([]);
  const seq = useRef(1);

  // 가짜 사람: 가끔 근처 칸으로 걸어가고, 가끔 말하거나 이모트
  useEffect(() => {
    const t = window.setInterval(() => {
      setPlayers((list) =>
        list.map((b) => {
          if (Math.random() < 0.5) return b;
          for (let i = 0; i < 8; i++) {
            const c = Math.floor(b.x / TILE) + Math.round((Math.random() - 0.5) * 6);
            const r = Math.floor(b.y / TILE) + Math.round((Math.random() - 0.5) * 6);
            if (walkable(c, r)) return { ...b, x: c * TILE + 8, y: r * TILE + 12 };
          }
          return b;
        }),
      );
      const who = BOTS[Math.floor(Math.random() * BOTS.length)];
      const id = String(seq.current++);
      if (Math.random() < 0.35) setMessages((m) => [...m, { id, playerId: who.id, name: who.name, text: LINES[Math.floor(Math.random() * LINES.length)] }]);
      else if (Math.random() < 0.25) setEmotes((e) => [...e, { id, playerId: who.id, kind: EMOTES[Math.floor(Math.random() * 4)].kind }]);
    }, 1400);
    return () => window.clearInterval(t);
  }, []);

  return (
    <PlazaView
      roomName="득근 광장"
      start={start}
      theme={plazaThemeOf(query.get("theme"))}
      title={query.get("title")}
      me={ME}
      players={players}
      messages={messages}
      emotes={emotes}
      status={<span className="dg-chip bg-plate-green text-black">연결됨</span>}
      onMove={() => undefined}
      onSend={(text) => setMessages((m) => [...m, { id: String(seq.current++), playerId: ME.id, name: ME.name, text, mine: true }])}
      onEmote={(kind: EmoteKind) => setEmotes((e) => [...e, { id: String(seq.current++), playerId: ME.id, kind }])}
      playerActions={() => (
        <>
          <button type="button" className="dg-btn dg-btn-primary min-h-[36px] px-3 text-xs">
            친구 신청
          </button>
          <button type="button" className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
            응원 보내기
          </button>
        </>
      )}
    />
  );
}
