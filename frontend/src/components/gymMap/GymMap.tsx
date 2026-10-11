import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { barbellWeight } from "../gym/plates";
import { logEvent } from "../../utils/analytics";
import {
  MAP_H,
  MAP_W,
  TILE,
  ZONES,
  ZONE_IDS,
  createGymMap,
  toneForMbti,
  NPC_ROLES,
  type NpcId,
  type GymMapController,
  type ZoneId,
} from "./engine";
import "./gymMap.css";

type Props = {
  loggedIn: boolean;
  level?: number | null;
  tier?: string | null;
  title?: string | null;
  /** 거울 앞에서 보여 줄 내 캐릭터(AvatarRenderer) */
  avatar?: ReactNode;
  mbti?: string | null;
  weekDays: number;
  streak: number;
  monthCount?: number | null;
  checkedToday: boolean;
  todayLabel: string;
  loungeCount: number | null;
  events: { id: number; title: string }[];
  /** 출석하고 막 돌아온 순간 — 원판이 날아가 바벨에 꽂히는 연출 */
  celebrate: boolean;
};

const DOCK: { zone: ZoneId; label: string }[] = [
  { zone: "checkin", label: "출석" },
  { zone: "lounge", label: "라운지" },
  { zone: "rack", label: "내 기록" },
  { zone: "mirror", label: "캐릭터" },
];

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};

const NPC_IDS = Object.keys(NPC_ROLES) as NpcId[];
const COACH_TIPS = [
  "스쿼트는 무릎이 발끝 방향을 따라가게!",
  "세트 사이 휴식은 1~2분이면 충분해요.",
  "물 자주 마셔요. 근육의 70%가 물이에요.",
  "무게보다 자세 먼저. 거울 보면서 해 봐요.",
];
const STAFF_LINES = ["바닥 닦는 중이에요. 미끄러우니 조심!", "덤벨은 쓰고 나서 제자리에 부탁해요.", "오늘도 매트 반짝반짝!"];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const pct = (x: number, y: number) => ({ left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%` });

type Sheet = { title: string; body: ReactNode; to: string; cta: string };

export default function GymMap(props: Props) {
  const { loggedIn, weekDays, streak, checkedToday, loungeCount, mbti, celebrate } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GymMapController | null>(null);
  const celebratedRef = useRef(false);
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [touched, setTouched] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [floatKey, setFloatKey] = useState(0);
  const [shake, setShake] = useState(false);
  const toastRef = useRef<number | undefined>(undefined);
  const npcTagRefs = useRef<Partial<Record<NpcId, HTMLDivElement | null>>>({});
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [talk, setTalk] = useState<{ id: NpcId; text: string; key: number } | null>(null);
  const talkTimer = useRef<number | undefined>(undefined);
  const talkingId = useRef<NpcId | null>(null);
  // 직원 대사는 내 실제 기록으로 만든다(지어낸 숫자 없음)
  const facts = useRef({ loggedIn, weekDays, streak, checkedToday });
  useEffect(() => {
    facts.current = { loggedIn, weekDays, streak, checkedToday };
  }, [loggedIn, weekDays, streak, checkedToday]);
  const lineFor = (id: NpcId): string => {
    const f = facts.current;
    if (id === "owner") {
      if (!f.loggedIn) return "어서 와요! 로그인하고 출석부터 해 볼까요?";
      return f.checkedToday ? `연속 ${f.streak}일째네요. 내일도 봐요!` : "오늘 출석 아직이죠? 체크기는 입구 옆이에요.";
    }
    if (id === "coach") {
      if (f.loggedIn && Math.random() < 0.5) {
        return f.weekDays >= 7 ? "이번 주 원판 꽉 찼어요. 대단해요!" : `이번 주 ${7 - f.weekDays}일 더 하면 바벨이 꽉 차요.`;
      }
      return pick(COACH_TIPS);
    }
    return pick(STAFF_LINES);
  };
  const say = (id: NpcId, text: string) => {
    talkingId.current = id;
    setTalk({ id, text, key: Date.now() });
    window.clearTimeout(talkTimer.current);
    talkTimer.current = window.setTimeout(() => {
      talkingId.current = null;
      setTalk(null);
    }, 3400);
  };
  const sayRef = useRef(say);
  const lineRef = useRef(lineFor);
  useEffect(() => {
    sayRef.current = say;
    lineRef.current = lineFor;
  });

  const latestStreak = useRef(streak);
  useEffect(() => {
    latestStreak.current = streak;
  }, [streak]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(null), 2400);
  };

  // 엔진은 한 번만 만든다. 데이터는 setState 로 흘려 넣는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map = createGymMap(
      canvas,
      { plates: weekDays, checked: checkedToday, loungeCount: loungeCount ?? 0, tone: toneForMbti(mbti) },
      {
        onZone: (z) => {
          setZone(z);
          if (z) {
            try {
              navigator.vibrate?.(8);
            } catch {
              /* 진동 미지원 */
            }
            void logEvent("home", "map_zone", { zone: z });
          }
        },
        onPlayer: (x, y) => {
          const el = meRef.current;
          if (!el) return;
          el.style.left = `${(x / MAP_W) * 100}%`;
          el.style.top = `${(y / MAP_H) * 100}%`;
        },
        onNpcs: (pos) => {
          for (const id of NPC_IDS) {
            const el = npcTagRefs.current[id];
            const p = pos[id];
            if (!el || !p) continue;
            el.style.left = `${(p[0] / MAP_W) * 100}%`;
            el.style.top = `${(p[1] / MAP_H) * 100}%`;
            if (talkingId.current === id && bubbleRef.current) {
              bubbleRef.current.style.left = el.style.left;
              bubbleRef.current.style.top = `${((p[1] - 10) / MAP_H) * 100}%`;
            }
          }
        },
        onNpcTalk: (id) => {
          setTouched(true);
          sayRef.current(id, lineRef.current(id));
          void logEvent("home", "map_npc", { npc: id });
        },
        onPlateLanded: () => {
          setShake(false);
          window.requestAnimationFrame(() => setShake(true));
          setFloatKey((k) => k + 1);
          try {
            navigator.vibrate?.([25, 40, 70]);
          } catch {
            /* 진동 미지원 */
          }
          showToast(`출석 완료 · 연속 ${latestStreak.current}일`);
        },
      },
    );
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
      window.clearTimeout(toastRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setState({ plates: weekDays, checked: checkedToday, loungeCount: loungeCount ?? 0, tone: toneForMbti(mbti) });
  }, [weekDays, checkedToday, loungeCount, mbti]);

  useEffect(() => {
    if (!celebrate || celebratedRef.current || !mapRef.current) return;
    celebratedRef.current = true;
    setTouched(true);
    mapRef.current.celebrate();
  }, [celebrate]);

  // 가끔 직원이 혼잣말(창이 열려 있거나 누가 말하는 중이면 쉬고, 동작 줄이기 설정이면 끔)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden || talkingId.current) return;
      const who = pick<NpcId>(["coach", "staff", "coach"]);
      sayRef.current(who, lineRef.current(who));
    }, 15000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(talkTimer.current);
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setTouched(true);
    mapRef.current?.tapAt((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[key] && e.target === wrapRef.current) {
      e.preventDefault();
      setTouched(true);
      mapRef.current?.step(...KEYS[key]);
    } else if (e.key === "Escape") {
      mapRef.current?.clearZone();
      setZone(null);
    }
  };

  const go = (z: ZoneId, fast: boolean) => {
    setTouched(true);
    mapRef.current?.goZone(z, fast);
  };

  const kg = barbellWeight(weekDays);
  const sheet = useMemo<Sheet | null>(() => {
    if (!zone) return null;
    switch (zone) {
      case "checkin":
        if (!loggedIn)
          return {
            title: "로그인하고 출석하기",
            body: <p>운동 사진을 올리면 출석이 기록되고, 파워랙 바벨에 원판이 하나 꽂혀요.</p>,
            to: "/login",
            cta: "로그인",
          };
        return checkedToday
          ? {
              title: "오늘 출석 완료",
              body: (
                <p>
                  {props.todayLabel}. 이번 주 바벨은 <b className="font-num">{kg}kg</b>, 연속 출석 <b className="font-num">{streak}</b>일이에요.
                </p>
              ),
              to: "/attendance",
              cta: "출석 기록 보기",
            }
          : {
              title: "오늘 출석하고 원판 받기",
              body: (
                <p>
                  운동 사진을 올리면 출석이 기록되고 바벨에 원판이 하나 꽂혀요. 연속 <b className="font-num">{streak}</b>일 · 이번 주{" "}
                  <b className="font-num">{weekDays}/7</b>
                </p>
              ),
              to: "/attendance",
              cta: "출석하러 가기",
            };
      case "rack":
        return {
          title: `이번 주 바벨 ${kg}kg`,
          body: (
            <>
              <div className="gm-figures">
                <div>
                  <span>이번 주</span>
                  <b className="font-num">{weekDays}/7</b>
                </div>
                <div>
                  <span>연속 출석</span>
                  <b className="font-num">{streak}일</b>
                </div>
                <div>
                  <span>이번 달 운동</span>
                  <b className="font-num">{props.monthCount ?? 0}일</b>
                </div>
              </div>
              <p>{loggedIn ? "운동한 날마다 바벨에 원판이 한 장씩 꽂혀요." : "로그인하고 출석하면 원판이 꽂혀요."}</p>
            </>
          ),
          to: loggedIn ? "/mypage" : "/login",
          cta: loggedIn ? "내 기록 보기" : "로그인",
        };
      case "mirror":
        return props.avatar
          ? {
              title: props.title || "이름 없는 리프터",
              body: (
                <div className="gm-mirror">
                  <div className="gm-mirror-glass">{props.avatar}</div>
                  <div className="gm-mirror-meta">
                    <span className="dg-chip">{props.tier}</span>
                    <b className="font-num">LV {props.level}</b>
                    <p>출석과 운동 기록이 캐릭터를 키워요.</p>
                  </div>
                </div>
              ),
              to: "/mypage",
              cta: "캐릭터 보기",
            }
          : {
              title: "거울 앞",
              body: <p>{loggedIn ? "캐릭터를 불러오는 중이에요." : "로그인하면 거울에 내 캐릭터가 비쳐요."}</p>,
              to: loggedIn ? "/mypage" : "/login",
              cta: loggedIn ? "마이페이지" : "로그인",
            };
      case "board":
        return {
          title: "화이트보드",
          body: props.events.length ? (
            <ul className="gm-board">
              {props.events.slice(0, 3).map((ev) => (
                <li key={ev.id}>
                  <Link to={`/events/${ev.id}`}>{ev.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="gm-board">
              <p>진행 중인 이벤트가 없어요.</p>
            </div>
          ),
          to: "/events",
          cta: "이벤트 전체 보기",
        };
      case "lounge":
        return {
          title: loungeCount === null ? "라운지" : `라운지 · 지금 ${loungeCount}명`,
          body: <p>캐릭터로 들어가 같이 운동하고 채팅하는 공간이에요. 벤치에 앉은 사람 수가 지금 라운지 인원이에요(최대 3명까지 보여요).</p>,
          to: "/lounge",
          cta: "라운지 들어가기",
        };
      case "crew":
        return {
          title: "운동 모임",
          body: <p>모임을 만들거나 들어가서 같이 출석률을 채워요. 모임 챌린지와 하이라이트도 여기 있어요.</p>,
          to: "/crew",
          cta: "운동 모임 보기",
        };
      case "community":
        return {
          title: "게시판",
          body: (
            <div className="gm-links">
              <Link to="/brag">자랑방</Link>
              <Link to="/reviews">단백질 리뷰</Link>
              <Link to="/protein">공동구매</Link>
              <Link to="/friends">친구 · 채팅</Link>
            </div>
          ),
          to: "/brag",
          cta: "자랑방 가기",
        };
    }
  }, [zone, loggedIn, checkedToday, kg, streak, weekDays, loungeCount, props.todayLabel, props.monthCount, props.avatar, props.title, props.tier, props.level, props.events]);

  const shown = sheet;
  const close = () => {
    mapRef.current?.clearZone();
    setZone(null);
  };

  return (
    <div className="gm-app">
      <div className="gm-hud">
        <div className="gm-lv" aria-label="레벨">
          <small>LV</small>
          <b>{loggedIn && props.level ? props.level : "–"}</b>
        </div>
        <div className="gm-week">
          <div className="gm-week-top">
            <span>이번 주 원판</span>
            <b className="font-num">{weekDays} / 7</b>
          </div>
          <div className="gm-week-bar" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} className={i < weekDays ? "on" : ""} />
            ))}
          </div>
        </div>
        <div className="gm-streak">
          <b className="font-num">{streak}</b>
          <small>일 연속</small>
        </div>
      </div>

      <div
        ref={wrapRef}
        className={`gm-map ${shake ? "gm-shake" : ""}`}
        tabIndex={0}
        role="application"
        aria-label="헬스장 지도. 바닥을 누르거나 방향키로 걸을 수 있어요"
        onKeyDown={onKeyDown}
        onAnimationEnd={() => setShake(false)}
      >
        <canvas ref={canvasRef} width={MAP_W} height={MAP_H} onPointerDown={onPointerDown} />
        <div className="gm-overlay">
          {ZONE_IDS.map((id) => {
            const z = ZONES[id];
            return (
              <button
                key={id}
                type="button"
                className={`gm-label ${zone === id ? "on" : ""}`}
                style={pct(z.label[0] * TILE, z.label[1] * TILE + 8)}
                onClick={() => go(id, false)}
                aria-label={`${z.name}로 가기 · ${z.page}`}
              >
                {z.name}
                {z.page !== z.name && <span>{z.page}</span>}
              </button>
            );
          })}
          <div ref={meRef} className="gm-me">나</div>
          {NPC_IDS.map((id) => (
            <div
              key={id}
              ref={(el) => {
                npcTagRefs.current[id] = el;
              }}
              className="gm-npc"
            >
              {NPC_ROLES[id]}
            </div>
          ))}
          {talk && (
            <div key={talk.key} ref={bubbleRef} className="gm-bubble" role="status">
              <b>{NPC_ROLES[talk.id]}</b> {talk.text}
            </div>
          )}
          {floatKey > 0 && (
            <div key={floatKey} className="gm-float" style={pct(ZONES.checkin.anchor[0] * TILE + 8, ZONES.checkin.anchor[1] * TILE - 10)}>
              +1 원판
            </div>
          )}
        </div>
        <div className={`gm-hint ${touched ? "gone" : ""}`}>바닥을 눌러 걸어보세요</div>
        {toast && <div className="gm-toast">{toast}</div>}

        <section className={`gm-sheet ${sheet ? "open" : ""}`} aria-live="polite" aria-hidden={!sheet}>
          {shown && zone && (
            <>
              <p className="gm-eyebrow">
                {ZONES[zone].name === ZONES[zone].page ? ZONES[zone].name : `${ZONES[zone].name} · ${ZONES[zone].page}`}
              </p>
              <h2>{shown.title}</h2>
              {shown.body}
              <div className="gm-actions">
                <Link to={shown.to} className="dg-btn dg-btn-primary">
                  {shown.cta}
                </Link>
                <button type="button" className="dg-btn dg-btn-steel" onClick={close}>
                  닫기
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="gm-dock-cap">
        <span>바로 가기</span>
        <span>걷지 않고 바로 이동</span>
      </div>
      <nav className="gm-dock" aria-label="바로 가기">
        {DOCK.map((d) => (
          <button
            key={d.zone}
            type="button"
            className={`gm-dock-btn ${d.zone === "checkin" ? (checkedToday ? "done" : "primary") : ""}`}
            onClick={() => go(d.zone, true)}
          >
            {d.zone === "checkin" && checkedToday ? "출석 완료" : d.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
