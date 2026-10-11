import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { barbellWeight } from "../gym/plates";
import { logEvent } from "../../utils/analytics";
import AvatarRenderer from "../avatar/AvatarRenderer";
import { loadGuestCharacter, saveGuestCharacter, type GuestCharacter } from "./guestCharacter";
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

type Sheet = { title: string; body: ReactNode; to: string; cta: string; quiet?: boolean };

// 체험 캐릭터 만들기: MBTI 는 네 쌍 중 하나씩 고른다(모르면 처음 값 그대로)
const MBTI_PAIRS: [string, string][] = [["E", "I"], ["N", "S"], ["T", "F"], ["J", "P"]];
const randomMbti = () => MBTI_PAIRS.map((p) => p[Math.floor(Math.random() * 2)]).join("");
const SIGNUP_CTA = "Google로 시작하기";

function GuestAvatar({ guest, size }: { guest: GuestCharacter; size: number }) {
  return <AvatarRenderer avatarSeed="guest" tier="BRONZE" stage={1} gender={guest.gender} mbti={guest.mbti} size={size} />;
}

export default function GymMap(props: Props) {
  const { loggedIn, streak, loungeCount, celebrate } = props;
  // 로그인 전 체험: 임시 캐릭터를 만들고, 체크기에서 원판 꽂기를 한 번 해 볼 수 있다(기록은 안 남음)
  const [guest, setGuest] = useState<GuestCharacter | null>(() => loadGuestCharacter());
  const [draft, setDraft] = useState<GuestCharacter>(() => guest ?? { gender: "MALE", mbti: randomMbti() });
  const [builderOpen, setBuilderOpen] = useState(() => !guest);
  const [trialDone, setTrialDone] = useState(false);
  const isGuest = !loggedIn;
  const building = isGuest && builderOpen;
  const weekDays = isGuest ? (trialDone ? 1 : 0) : props.weekDays;
  const checkedToday = isGuest ? trialDone : props.checkedToday;
  const mbti = isGuest ? (building ? draft.mbti : guest?.mbti) : props.mbti;
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
  const facts = useRef({ loggedIn, weekDays, streak, checkedToday, hasGuest: Boolean(guest) });
  useEffect(() => {
    facts.current = { loggedIn, weekDays, streak, checkedToday, hasGuest: Boolean(guest) };
  }, [loggedIn, weekDays, streak, checkedToday, guest]);
  const lineFor = (id: NpcId): string => {
    const f = facts.current;
    if (id === "owner") {
      if (!f.loggedIn) {
        if (!f.hasGuest) return "어서 와요! 캐릭터부터 만들어 볼까요?";
        return f.checkedToday ? "어때요? 가입하면 매일 이렇게 쌓여요." : "입구 옆 체크기에서 출석 체험 해 봐요!";
      }
      return f.checkedToday ? `연속 ${f.streak}일째네요. 내일도 봐요!` : "오늘 출석 아직이죠? 체크기는 입구 옆이에요.";
    }
    if (id === "coach") {
      if (!f.loggedIn && f.hasGuest && Math.random() < 0.5) {
        return pick(["출석할 때마다 캐릭터가 자라요. 가입하면 그대로 이어져요.", "거울 앞에 가면 내 캐릭터를 크게 볼 수 있어요."]);
      }
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
          if (!facts.current.loggedIn) {
            // 체험: 원판이 꽂힌 걸 본 직후에 가입 안내를 다시 띄운다
            showToast("체험 출석 완료 · +1 원판");
            window.setTimeout(() => setZone("checkin"), 700);
            return;
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

  const createGuest = () => {
    saveGuestCharacter(draft);
    setGuest(draft);
    setBuilderOpen(false);
    setTouched(true);
    void logEvent("home", "guest_create", { mbti: draft.mbti, gender: draft.gender });
    sayRef.current("owner", "반가워요! 체크기에서 출석 체험 해 봐요.");
    // 만들자마자 체크기로 걸어가 "출석 체험" 창을 연다
    mapRef.current?.goZone("checkin", false);
  };

  const skipBuilder = () => {
    setBuilderOpen(false);
    void logEvent("home", "guest_skip", {});
  };

  const tryCheckin = useCallback(() => {
    if (trialDone) return;
    setTrialDone(true);
    mapRef.current?.clearZone();
    setZone(null);
    // 엔진에 먼저 1장을 넣고 연출 → 원판이 날아가 꽂힌다(React 상태 반영을 기다리지 않음)
    mapRef.current?.setState({ plates: 1, checked: true });
    mapRef.current?.celebrate();
    void logEvent("home", "guest_trial_checkin", {});
  }, [trialDone]);

  const signupClick = (from: string) => void logEvent("home", "guest_signup_click", { from });

  const kg = barbellWeight(weekDays);
  const sheet = useMemo<Sheet | null>(() => {
    if (!zone) return null;
    switch (zone) {
      case "checkin":
        if (!loggedIn && trialDone)
          return {
            title: "이렇게 원판이 쌓여요",
            body: (
              <p>
                가입하면 오늘부터 진짜로 기록돼요. 운동한 날마다 바벨에 원판이 꽂히고, 캐릭터가 자라요.
                {guest && " 지금 만든 캐릭터 그대로 시작해요."}
              </p>
            ),
            to: "/login",
            cta: SIGNUP_CTA,
          };
        if (!loggedIn)
          return {
            title: "출석 체험 해 보기",
            body: (
              <>
                <p>실제로는 운동 사진을 올리면 출석이 돼요. 지금은 연습으로 원판 한 장만 꽂아 봐요(기록은 안 남아요).</p>
                <button type="button" className="dg-btn dg-btn-primary gm-trial" onClick={tryCheckin}>
                  원판 꽂아 보기
                </button>
              </>
            ),
            to: "/login",
            cta: SIGNUP_CTA,
            quiet: true,
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
        if (!loggedIn && guest)
          return {
            title: "체험 중인 내 캐릭터",
            body: (
              <div className="gm-mirror">
                <div className="gm-mirror-glass">
                  <GuestAvatar guest={guest} size={96} />
                </div>
                <div className="gm-mirror-meta">
                  <span className="dg-chip">BRONZE</span>
                  <b className="font-num">LV 1</b>
                  <p>출석할수록 레벨과 티어가 올라가고 모습이 바뀌어요.</p>
                  <button type="button" className="gm-textbtn" onClick={() => {
                      mapRef.current?.clearZone();
                      setZone(null);
                      setDraft(guest);
                      setBuilderOpen(true);
                    }}>
                    다시 만들기
                  </button>
                </div>
              </div>
            ),
            to: "/login",
            cta: SIGNUP_CTA,
          };
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
  }, [zone, loggedIn, guest, trialDone, tryCheckin, checkedToday, kg, streak, weekDays, loungeCount, props.todayLabel, props.monthCount, props.avatar, props.title, props.tier, props.level, props.events]);

  const shown = building ? null : sheet;
  const close = () => {
    mapRef.current?.clearZone();
    setZone(null);
  };

  return (
    <div className="gm-app">
      <div className="gm-hud">
        <div className="gm-lv" aria-label="레벨">
          <small>LV</small>
          <b>{loggedIn && props.level ? props.level : isGuest && guest ? 1 : "–"}</b>
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
        <div className={`gm-hint ${touched || building ? "gone" : ""}`}>바닥을 눌러 걸어보세요</div>
        {toast && <div className="gm-toast">{toast}</div>}

        <section className={`gm-sheet ${shown ? "open" : ""}`} aria-live="polite" aria-hidden={!shown}>
          {shown && zone && (
            <>
              <p className="gm-eyebrow">
                {ZONES[zone].name === ZONES[zone].page ? ZONES[zone].name : `${ZONES[zone].name} · ${ZONES[zone].page}`}
              </p>
              <h2>{shown.title}</h2>
              {shown.body}
              <div className="gm-actions">
                <Link
                  to={shown.to}
                  className={`dg-btn ${shown.quiet ? "dg-btn-steel" : "dg-btn-primary"}`}
                  onClick={isGuest && shown.to === "/login" ? () => signupClick(zone) : undefined}
                >
                  {shown.cta}
                </Link>
                <button type="button" className="dg-btn dg-btn-steel" onClick={close}>
                  닫기
                </button>
              </div>
            </>
          )}
        </section>

        {building && (
          <section className="gm-sheet gm-guest open" aria-label="체험 캐릭터 만들기">
            <p className="gm-eyebrow">로그인 없이 둘러보기</p>
            <h2>내 캐릭터부터 만들어요</h2>
            <div className="gm-guest-row">
              <div className="gm-mirror-glass gm-guest-preview">
                <GuestAvatar guest={draft} size={88} />
              </div>
              <div className="gm-guest-pick">
                <div className="gm-seg" role="group" aria-label="성별">
                  {(["MALE", "FEMALE"] as const).map((g) => (
                    <button key={g} type="button" aria-pressed={draft.gender === g} onClick={() => setDraft((d) => ({ ...d, gender: g }))}>
                      {g === "MALE" ? "남" : "여"}
                    </button>
                  ))}
                </div>
                <div className="gm-seg-label">MBTI · 색과 움직임이 바뀌어요</div>
                {MBTI_PAIRS.map((pair, i) => (
                  <div key={pair.join("")} className="gm-seg" role="group" aria-label={`MBTI ${i + 1}번째 글자`}>
                    {pair.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        aria-pressed={draft.mbti[i] === ch}
                        onClick={() => setDraft((d) => ({ ...d, mbti: d.mbti.slice(0, i) + ch + d.mbti.slice(i + 1) }))}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="gm-actions">
              <button type="button" className="dg-btn dg-btn-primary" onClick={createGuest}>
                이걸로 둘러보기
              </button>
              <button type="button" className="dg-btn dg-btn-steel" onClick={skipBuilder}>
                건너뛰기
              </button>
            </div>
            <p className="gm-guest-note">가입 전에는 이 기기에만 저장돼요. 가입하면 이 캐릭터로 시작해요.</p>
          </section>
        )}
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
            {d.zone === "checkin" ? (checkedToday ? (isGuest ? "체험 완료" : "출석 완료") : isGuest ? "출석 체험" : d.label) : d.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
