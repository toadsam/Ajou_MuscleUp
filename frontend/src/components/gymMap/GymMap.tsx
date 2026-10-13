import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { barbellWeight } from "../gym/plates";
import { logEvent } from "../../utils/analytics";
import AvatarRenderer from "../avatar/AvatarRenderer";
import { loadGuestCharacter, saveGuestCharacter, type GuestCharacter } from "./guestCharacter";
import {
  DEFAULT_LAYOUT,
  HAIR_COLOR,
  HAIR_SLOT,
  HIRES,
  SLOTS,
  SLOT_IDS,
  UNIFORM_COLOR,
  paintPreview,
  staffLookOf,
  SCENE_UNLOCK,
  type DecorSlot,
  type SceneId,
  type SlotId,
  type StaffId,
  type StaffLook,
} from "./decor";
import { LIFT_EXERCISES } from "../../lib/lifts";
import { SCENES } from "./scenes";
import { exerciseGuide } from "../../lib/exerciseGuide";
import { fetchDecor, layoutOf, placeDecor, readSeen, writeSeen, type DecorItem, type DecorView } from "../../lib/gymDecor";
import { deleteGuestbook, fetchMyGuestbook, readGuestbookSeen, writeGuestbookSeen, type GuestbookEntry } from "../../lib/gymVisit";
import { timeAgo } from "../../lib/timeAgo";
import ReportDialog from "../ReportDialog";
import { friendlyError } from "../../lib/httpError";
import { toast as appToast } from "../../lib/toast";
import {
  MAP_H,
  MAP_W,
  TILE,
  ZONES,
  ZONE_IDS,
  PORTAL,
  createGymMap,
  paintStaffPreview,
  paintScenePreview,
  paintThemePreview,
  toneForMbti,
  NPC_ROLES,
  SCENE_NPCS,
  type NpcId,
  type GymMapController,
  type MapZone,
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

/** 바로 가기: 지도 장소(zone)는 걸어가서 창을 열고, 지도에 없는 화면(to)은 바로 넘어간다 */
const DOCK: ({ zone: ZoneId; label: string } | { to: string; label: string })[] = [
  { zone: "checkin", label: "출석" },
  { to: "/diet", label: "식단" },
  { to: "/workout/session", label: "운동 시작" },
  { zone: "rack", label: "내 기록" },
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
const CLEANER_LINES = ["기구 닦는 중이에요. 쓰고 나면 한 번 닦아 주세요!", "러닝머신 손잡이까지 반짝반짝!", "라운지 벤치 소독 끝!"];
const BASE_STAFF: StaffId[] = ["coach", "owner", "staff"];
const RUN_TIPS = [
  "처음 10분은 옆 사람과 대화가 될 만큼 천천히!",
  "보폭은 짧게, 발은 몸 바로 아래에 디뎌요.",
  "어깨 힘 빼고 팔은 앞뒤로만 흔들어요.",
  "숨이 차면 걷기 1분, 다시 달리기. 그것도 러닝이에요.",
  "기록은 앱 러닝 화면에서 켜 두면 거리가 쌓여요.",
];
const DIET_TIPS = [
  "단백질은 한 번에 몰지 말고 끼니마다 나눠 먹어요.",
  "운동 끝나고 탄수화물도 같이 먹어야 회복이 빨라요.",
  "물은 하루 1.5~2L, 운동하는 날은 더!",
  "자주 먹는 음식은 식단의 '내 음식'에 저장해 두면 편해요.",
  "채소 한 접시 먼저 먹으면 과식이 줄어요.",
];
const pickOne = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const pct = (x: number, y: number) => ({ left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%` });

type Sheet = { title: string; body: ReactNode; to: string; cta: string; quiet?: boolean };

// 체험 캐릭터 만들기: MBTI 는 네 쌍 중 하나씩 고른다(모르면 처음 값 그대로)
const MBTI_PAIRS: [string, string][] = [["E", "I"], ["N", "S"], ["T", "F"], ["J", "P"]];
const randomMbti = () => MBTI_PAIRS.map((p) => p[Math.floor(Math.random() * 2)]).join("");
const SIGNUP_CTA = "Google로 시작하기";

/** 꾸미기 창: 그 자리에 놓았을 때 모습 */
function DecorPreview({ slot, code }: { slot: SlotId; code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPreview(ref.current, slot, code);
  }, [slot, code]);
  return <canvas ref={ref} className="gm-decor-preview" aria-hidden="true" />;
}

function ThemePreview({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintThemePreview(ref.current, code);
  }, [code]);
  return <canvas ref={ref} className="gm-decor-preview" aria-hidden="true" />;
}

function ScenePreview({ scene, theme }: { scene: Exclude<SceneId, "MAIN">; theme?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintScenePreview(ref.current, scene, theme);
  }, [scene, theme]);
  return <canvas ref={ref} className="gm-decor-preview" aria-hidden="true" />;
}

function StaffPreview({ id, look }: { id: NpcId; look: StaffLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintStaffPreview(ref.current, id, look);
  }, [id, look]);
  return <canvas ref={ref} className="gm-decor-preview gm-staff-preview" aria-hidden="true" />;
}

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
  const [zone, setZone] = useState<MapZone | null>(null);
  // 지금 공간(1층 · 2층 · 러닝 트랙 · 식당). 1층 입구 매트에서 고르고, 다른 공간 출구에 서면 1층으로
  const [scene, setScene] = useState<SceneId>("MAIN");
  const sceneRef = useRef<SceneId>("MAIN");
  const [touched, setTouched] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [floatKey, setFloatKey] = useState(0);
  const [shake, setShake] = useState(false);
  const toastRef = useRef<number | undefined>(undefined);
  const npcTagRefs = useRef<Partial<Record<NpcId, HTMLDivElement | null>>>({});
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [talk, setTalk] = useState<{ id: NpcId; text: string; key: number } | null>(null);
  // 꾸미기: 기록으로 얻은 물품을 자리(슬롯)에 넣고 뺀다(로그인한 사람만)
  const [decor, setDecor] = useState<DecorView | null>(null);
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<SlotId | null>(null);
  /** 꾸미기 중 테마 · 직원 창 */
  const [panel, setPanel] = useState<"theme" | "staff" | null>(null);
  // 내 헬스장 방명록(친구가 놀러 와 남긴 한 줄)
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookSeen, setBookSeen] = useState(() => readGuestbookSeen());
  const [reportId, setReportId] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [seen, setSeen] = useState<Set<string> | null>(() => readSeen());
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
        return pickOne(["출석할 때마다 캐릭터가 자라요. 가입하면 그대로 이어져요.", "거울 앞에 가면 내 캐릭터를 크게 볼 수 있어요."]);
      }
      if (f.loggedIn && Math.random() < 0.5) {
        return f.weekDays >= 7 ? "이번 주 원판 꽉 찼어요. 대단해요!" : `이번 주 ${7 - f.weekDays}일 더 하면 바벨이 꽉 차요.`;
      }
      return pickOne(COACH_TIPS);
    }
    if (id === "trainer") {
      const ex = pickOne(LIFT_EXERCISES);
      return `${ex.label} — ${exerciseGuide(ex).tip}`;
    }
    if (id === "cleaner") return pickOne(CLEANER_LINES);
    if (id === "towel") return f.checkedToday ? "오늘 땀 좀 흘렸죠? 수건 여기요!" : "수건 챙겨 가요. 다 쓰면 바구니에!";
    if (id === "runcoach") return pickOne(RUN_TIPS);
    if (id === "dietitian") return pickOne(DIET_TIPS);
    return pickOne(STAFF_LINES);
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
          if (z === "exit") {
            changeSceneRef.current("MAIN");
            return;
          }
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
    if (!loggedIn) {
      setDecor(null);
      setEditing(false);
      return;
    }
    let alive = true;
    fetchDecor()
      .then((view) => alive && setDecor(view))
      .catch(() => undefined); // 못 불러오면 기본 모습 그대로
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) {
      setGuestbook([]);
      setBookOpen(false);
      return;
    }
    let alive = true;
    fetchMyGuestbook()
      .then((list) => alive && setGuestbook(Array.isArray(list) ? list : []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loggedIn]);
  const newEntries = guestbook.filter((e) => e.id > bookSeen).length;
  const openBook = () => {
    mapRef.current?.clearZone();
    setZone(null);
    setBookOpen(true);
    const top = guestbook[0]?.id ?? 0;
    if (top > bookSeen) {
      writeGuestbookSeen(top);
      setBookSeen(top);
    }
    void logEvent("home", "guestbook_open", { count: guestbook.length });
  };
  const removeEntry = async (id: number) => {
    try {
      await deleteGuestbook(id);
      setGuestbook((list) => list.filter((e) => e.id !== id));
    } catch (err) {
      appToast(friendlyError(err, "지우지 못했어요."), "error");
    }
  };

  const layout = useMemo(() => (decor ? layoutOf(decor) : DEFAULT_LAYOUT), [decor]);
  const look = useMemo(() => staffLookOf(layout), [layout]);
  const hiredRef = useRef<NpcId[]>([]);
  useEffect(() => {
    hiredRef.current = look.hired;
  }, [look]);
  useEffect(() => {
    mapRef.current?.setState({ decor: layout });
  }, [layout]);
  useEffect(() => {
    mapRef.current?.setState({ decorEdit: editing, decorPick: pick });
  }, [editing, pick]);

  const itemOf = (code: string | null | undefined) => (code ? decor?.items.find((i) => i.code === code) : undefined);
  // 기본 물품(조건 없음)은 "새 물품"으로 세지 않는다
  const earned = decor ? decor.items.filter((i) => i.owned && i.goal > 0).map((i) => i.code) : [];
  const fresh = earned.filter((c) => !seen?.has(c));

  const startEdit = () => {
    setBookOpen(false);
    mapRef.current?.clearZone();
    setZone(null);
    setTouched(true);
    setEditing(true);
    setPick(null);
    setPanel(null);
    writeSeen(earned);
    setSeen(new Set(earned));
    void logEvent("home", "decor_open", { fresh: fresh.length });
  };
  const endEdit = () => {
    setEditing(false);
    setPick(null);
    setPanel(null);
  };
  /** 지도 자리면 창을 닫아 바로 보이게, 테마 · 직원 창은 열어 둔 채로 */
  const place = async (slot: DecorSlot, code: string | null, done?: string) => {
    if (placing) return;
    setPlacing(true);
    try {
      const view = await placeDecor(slot, code);
      setDecor(view);
      const label = view.items.find((i) => i.code === code)?.label;
      if (slot in SLOTS) {
        setPick(null);
        const name = SLOTS[slot as SlotId].name;
        showToast(label ? `${label} · ${name}에 놓았어요` : `${name} 자리를 비웠어요`);
      } else if (done) {
        showToast(done);
      }
      void logEvent("home", "decor_place", { slot, code: code ?? "" });
    } catch (err) {
      appToast(friendlyError(err, "꾸미지 못했어요. 잠시 뒤 다시 해 주세요."), "error");
    } finally {
      setPlacing(false);
    }
  };

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
      const here = sceneRef.current;
      const people: NpcId[] = here === "MAIN" ? ["coach", "staff", "coach", ...hiredRef.current] : SCENE_NPCS[here];
      if (!people.length) return;
      const who = pickOne<NpcId>(people);
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
    } else if (e.key === "Escape" && bookOpen) {
      setBookOpen(false);
    } else if (e.key === "Escape" && editing) {
      if (pick || panel) {
        setPick(null);
        setPanel(null);
      } else endEdit();
    } else if (e.key === "Escape") {
      mapRef.current?.clearZone();
      setZone(null);
    }
  };

  const changeScene = (next: SceneId) => {
    if (next === sceneRef.current) return;
    sceneRef.current = next;
    mapRef.current?.clearZone();
    mapRef.current?.setState({ scene: next });
    setScene(next);
    setZone(null);
    setPick(null);
    talkingId.current = null;
    setTalk(null);
    showToast(next === "MAIN" ? "1층으로 돌아왔어요" : `${SCENES[next].name}에 왔어요`);
    void logEvent("home", "map_scene", { scene: next });
  };
  const changeSceneRef = useRef(changeScene);
  useEffect(() => {
    changeSceneRef.current = changeScene;
  });

  const go = (z: ZoneId, fast: boolean) => {
    setTouched(true);
    // 휴대폰에선 바로 가기가 화면 아래 고정이라, 지도가 화면 밖이면 지도부터 보여 준다(걸어가서 열리는 창이 보이게)
    const box = wrapRef.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight - 90)) wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // 다른 공간에 있으면 1층으로 먼저(바로 가기 버튼)
    if (sceneRef.current !== "MAIN") changeScene("MAIN");
    mapRef.current?.goZone(z, fast);
  };
  /** 지도 칸(타일)으로 걸어가기 — 포탈 · 출구 이름표 */
  const walkTo = (c: number, r: number) => {
    setTouched(true);
    mapRef.current?.tapAt((c * TILE + 8) / MAP_W, (r * TILE + 8) / MAP_H);
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
      default:
        return null; // 포탈 · 출구는 따로
    }
  }, [zone, loggedIn, guest, trialDone, tryCheckin, checkedToday, kg, streak, weekDays, loungeCount, props.todayLabel, props.monthCount, props.avatar, props.title, props.tier, props.level, props.events]);

  const shown = building || editing || bookOpen ? null : sheet;
  const portalOpen = zone === "portal" && !building && !editing && !bookOpen;
  const spaces = (Object.keys(SCENE_UNLOCK) as Exclude<SceneId, "MAIN">[]).map((id) => ({ id, item: itemOf(SCENE_UNLOCK[id]) }));
  const pickedCode = pick ? layout[pick] ?? null : null;
  const pickItems: DecorItem[] = pick && decor
    ? decor.items.filter((i) => i.slots.includes(pick)).sort((a, b) => Number(b.owned) - Number(a.owned))
    : [];
  const placedAt = (code: string) => SLOT_IDS.find((id) => id !== pick && layout[id] === code);
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
        // 창 안 버튼에 초점이 남은 채 창이 내려가면 브라우저가 지도 상자를 스크롤한다 — 지도는 늘 제자리
        onScroll={(e) => {
          if (e.currentTarget.scrollTop) e.currentTarget.scrollTop = 0;
        }}
      >
        <canvas ref={canvasRef} width={MAP_W} height={MAP_H} onPointerDown={onPointerDown} />
        <div className="gm-overlay">
          {editing &&
            SLOT_IDS.filter((id) => SLOTS[id].scene === scene).map((id) => {
              const [x, y, w, h] = SLOTS[id].box;
              const item = itemOf(layout[id]);
              return (
                <button
                  key={id}
                  type="button"
                  className={`gm-slot ${pick === id ? "on" : ""}`}
                  style={{ ...pct(x, y), width: `${(w / MAP_W) * 100}%`, height: `${(h / MAP_H) * 100}%` }}
                  onClick={() => setPick(id)}
                  aria-label={`${SLOTS[id].name} 자리 · ${item ? item.label : "비어 있음"}`}
                />
              );
            })}
          {!editing && scene === "MAIN" && (
            <button
              type="button"
              className={`gm-label ${zone === "portal" ? "on" : ""}`}
              style={pct(PORTAL.label[0] * TILE, PORTAL.label[1] * TILE + 8)}
              onClick={() => walkTo(7, 24)}
              aria-label="입구로 가기 · 다른 공간"
            >
              입구<span>다른 공간</span>
            </button>
          )}
          {!editing && scene !== "MAIN" && (
            <button
              type="button"
              className="gm-label"
              style={pct(8 * TILE, 24 * TILE - 4)}
              onClick={() => walkTo(7, 24)}
              aria-label={`${SCENES[scene].exitName}`}
            >
              {SCENES[scene].exitName}
            </button>
          )}
          {scene !== "MAIN" && <div className="gm-scene-chip">{SCENES[scene].name}</div>}
          {!editing && scene === "MAIN" && ZONE_IDS.map((id) => {
            const z = ZONES[id];
            return (
              <button
                key={id}
                type="button"
                className={`gm-label ${zone === id ? "on" : ""}`}
                style={pct(z.label[0] * TILE, z.label[1] * TILE + 8)}
                onClick={() => go(id, false)}
                aria-label={`${z.name} 앞으로 가기 · ${z.page}`}
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
              className={`gm-npc ${(scene === "MAIN" ? ([...BASE_STAFF, ...look.hired] as NpcId[]).includes(id) : SCENE_NPCS[scene].includes(id)) ? "" : "off"}`}
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
        {toast && <div className={`gm-toast ${editing ? "gm-toast-low" : ""}`}>{toast}</div>}
        {editing && !pick && !panel && (
          <div className="gm-decor-bar" role="status">
            <span>
              꾸밀 자리를 눌러요 · 얻은 것 <b className="font-num">{decor ? `${decor.owned}/${decor.total}` : "–"}</b>
            </span>
            <div className="gm-decor-bar-actions">
              <button type="button" className="dg-btn dg-btn-steel" onClick={() => setPanel("theme")}>
                테마
              </button>
              <button type="button" className="dg-btn dg-btn-steel" onClick={() => setPanel("staff")}>
                직원
              </button>
              <button type="button" className="dg-btn dg-btn-primary" onClick={endEdit}>
                다 했어요
              </button>
            </div>
          </div>
        )}

        <section className={`gm-sheet ${portalOpen ? "open" : ""}`} aria-live="polite" aria-hidden={!portalOpen}>
          {portalOpen && (
            <>
              <p className="gm-eyebrow">입구 · 다른 공간</p>
              <h2>어디로 갈까요?</h2>
              <ul className="gm-decor-list">
                {spaces.map(({ id, item }) => {
                  const open = Boolean(item?.owned);
                  return (
                    <li key={id} className={open ? "" : "locked"}>
                      <ScenePreview scene={id} theme={layout.THEME} />
                      <div className="gm-decor-info">
                        <b>{SCENES[id].name}</b>
                        <small>{!loggedIn ? "로그인하면 기록으로 열 수 있어요" : open ? "열렸어요" : item?.hint ?? "불러오는 중"}</small>
                        {loggedIn && item && !open && (
                          <span className="gm-decor-track" aria-hidden="true">
                            <i style={{ width: `${Math.round((item.progress / Math.max(1, item.goal)) * 100)}%` }} />
                          </span>
                        )}
                      </div>
                      {open ? (
                        <button type="button" className="dg-btn dg-btn-primary" onClick={() => changeScene(id)}>
                          가기
                        </button>
                      ) : (
                        <span className="gm-decor-state font-num">{loggedIn && item ? `${item.progress}/${item.goal}` : "잠김"}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="gm-actions">
                <button type="button" className="dg-btn dg-btn-steel" onClick={close}>
                  닫기
                </button>
              </div>
            </>
          )}
        </section>

        <section className={`gm-sheet gm-decor-sheet ${bookOpen ? "open" : ""}`} aria-live="polite" aria-hidden={!bookOpen}>
          {bookOpen && (
            <>
              <p className="gm-eyebrow">내 헬스장</p>
              <h2>방명록</h2>
              {guestbook.length === 0 ? (
                <p>아직 다녀간 친구가 없어요. 친구 목록에서 친구 헬스장에 놀러 가 한 줄 남겨 봐요.</p>
              ) : (
                <ul className="gm-book">
                  {guestbook.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <small>
                          <b>{entry.nickname}</b> · {timeAgo(entry.createdAt)}
                        </small>
                        <p>{entry.message}</p>
                      </div>
                      <span className="gm-book-actions">
                        <button type="button" className="gm-textbtn" onClick={() => setReportId(entry.id)}>
                          신고
                        </button>
                        <button type="button" className="gm-textbtn" onClick={() => void removeEntry(entry.id)}>
                          지우기
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="gm-actions">
                <Link to="/friends" className="dg-btn dg-btn-primary">
                  친구 헬스장 놀러 가기
                </Link>
                <button type="button" className="dg-btn dg-btn-steel" onClick={() => setBookOpen(false)}>
                  닫기
                </button>
              </div>
            </>
          )}
        </section>

        <section className={`gm-sheet gm-decor-sheet ${editing && panel ? "open" : ""}`} aria-live="polite" aria-hidden={!(editing && panel)}>
          {editing && panel === "theme" && (
            <>
              <p className="gm-eyebrow">꾸미기 · 테마</p>
              <h2>{itemOf(layout.THEME)?.label ?? "고무 매트"}</h2>
              <p>바닥과 벽이 바뀌어요. 기구 · 물품은 그대로예요.</p>
              <ul className="gm-decor-list">
                {(decor?.items ?? []).filter((i) => i.kind === "THEME").map((item) => (
                  <li key={item.code} className={item.owned ? "" : "locked"}>
                    <ThemePreview code={item.code} />
                    <div className="gm-decor-info">
                      <b>{item.label}</b>
                      <small>{item.hint}</small>
                      {!item.owned && (
                        <span className="gm-decor-track" aria-hidden="true">
                          <i style={{ width: `${Math.round((item.progress / Math.max(1, item.goal)) * 100)}%` }} />
                        </span>
                      )}
                    </div>
                    {!item.owned ? (
                      <span className="gm-decor-state font-num" aria-label={`진행 ${item.progress} / ${item.goal}`}>
                        {item.progress}/{item.goal}
                      </span>
                    ) : layout.THEME === item.code ? (
                      <span className="gm-decor-state">쓰는 중</span>
                    ) : (
                      <button type="button" className="dg-btn dg-btn-steel" disabled={placing} onClick={() => void place("THEME", item.code, `${item.label} 테마로 바꿨어요`)}>
                        바꾸기
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {editing && panel === "staff" && (
            <>
              <p className="gm-eyebrow">꾸미기 · 직원</p>
              <h2>직원 꾸미기</h2>
              <p className="gm-decor-sub">유니폼(모두 같이)</p>
              <div className="gm-swatches" role="group" aria-label="유니폼 색">
                {(decor?.items ?? []).filter((i) => i.slots.includes("UNIFORM")).map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    aria-pressed={layout.UNIFORM === item.code}
                    disabled={placing}
                    onClick={() => void place("UNIFORM", item.code, `${item.label}로 갈아입었어요`)}
                  >
                    <i style={{ background: UNIFORM_COLOR[item.code] }} />
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="gm-decor-sub">머리색</p>
              <ul className="gm-decor-list">
                {[...BASE_STAFF, ...look.hired].map((id) => (
                  <li key={id} className="gm-staff-row">
                    <StaffPreview id={id} look={look} />
                    <div className="gm-decor-info">
                      <b>{NPC_ROLES[id]}</b>
                      <div className="gm-hair" role="group" aria-label={`${NPC_ROLES[id]} 머리색`}>
                        {Object.keys(HAIR_COLOR).map((code) => (
                          <button
                            key={code}
                            type="button"
                            aria-pressed={(layout[HAIR_SLOT[id]] ?? DEFAULT_LAYOUT[HAIR_SLOT[id]]) === code}
                            aria-label={itemOf(code)?.label ?? code}
                            disabled={placing}
                            style={{ background: HAIR_COLOR[code] }}
                            onClick={() => void place(HAIR_SLOT[id], code, `${NPC_ROLES[id]} 머리색을 바꿨어요`)}
                          />
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="gm-decor-sub">새 직원</p>
              <ul className="gm-decor-list">
                {HIRES.map((hire) => {
                  const item = itemOf(hire.code);
                  if (!item) return null;
                  const working = layout[hire.slot] === hire.code;
                  return (
                    <li key={hire.code} className={item.owned ? "" : "locked"}>
                      <StaffPreview id={hire.id} look={look} />
                      <div className="gm-decor-info">
                        <b>{item.label}</b>
                        <small>{working ? "출근 중" : item.hint}</small>
                        {!item.owned && (
                          <span className="gm-decor-track" aria-hidden="true">
                            <i style={{ width: `${Math.round((item.progress / Math.max(1, item.goal)) * 100)}%` }} />
                          </span>
                        )}
                      </div>
                      {!item.owned ? (
                        <span className="gm-decor-state font-num" aria-label={`진행 ${item.progress} / ${item.goal}`}>
                          {item.progress}/{item.goal}
                        </span>
                      ) : working ? (
                        <button type="button" className="dg-btn dg-btn-steel" disabled={placing} onClick={() => void place(hire.slot, null, `${item.label} 쉬는 날`)}>
                          쉬게 하기
                        </button>
                      ) : (
                        <button type="button" className="dg-btn dg-btn-steel" disabled={placing} onClick={() => void place(hire.slot, hire.code, `${item.label} 출근!`)}>
                          출근
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {editing && panel && (
            <div className="gm-actions">
              <button type="button" className="dg-btn dg-btn-primary" onClick={() => setPanel(null)}>
                닫기
              </button>
            </div>
          )}
        </section>

        <section className={`gm-sheet gm-decor-sheet ${editing && pick ? "open" : ""}`} aria-live="polite" aria-hidden={!(editing && pick)}>
          {editing && pick && (
            <>
              <p className="gm-eyebrow">꾸미기 · {SLOTS[pick].name}</p>
              <h2>{itemOf(pickedCode)?.label ?? "비어 있는 자리"}</h2>
              {!decor ? (
                <p>물품을 불러오는 중이에요.</p>
              ) : (
                <ul className="gm-decor-list">
                  {pickItems.map((item) => {
                    const here = pickedCode === item.code;
                    const elsewhere = item.multi ? undefined : placedAt(item.code);
                    return (
                      <li key={item.code} className={item.owned ? "" : "locked"}>
                        <DecorPreview slot={pick} code={item.code} />
                        <div className="gm-decor-info">
                          <b>{item.label}</b>
                          {item.owned ? (
                            <small>{elsewhere ? `${SLOTS[elsewhere].name}에서 옮겨 와요` : item.hint}</small>
                          ) : (
                            <>
                              <small>{item.hint}</small>
                              <span className="gm-decor-track" aria-hidden="true">
                                <i style={{ width: `${Math.round((item.progress / Math.max(1, item.goal)) * 100)}%` }} />
                              </span>
                            </>
                          )}
                        </div>
                        {item.owned ? (
                          here ? (
                            <span className="gm-decor-state">놓여 있음</span>
                          ) : (
                            <button type="button" className="dg-btn dg-btn-steel" disabled={placing} onClick={() => void place(pick, item.code)}>
                              놓기
                            </button>
                          )
                        ) : (
                          <span className="gm-decor-state font-num" aria-label={`진행 ${item.progress} / ${item.goal}`}>
                            {item.progress}/{item.goal}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="gm-actions">
                <button type="button" className="dg-btn dg-btn-primary" onClick={() => setPick(null)}>
                  다른 자리 고르기
                </button>
                {pickedCode && (
                  <button type="button" className="dg-btn dg-btn-steel" disabled={placing} onClick={() => void place(pick, null)}>
                    비우기
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <section className={`gm-sheet ${shown ? "open" : ""}`} aria-live="polite" aria-hidden={!shown}>
          {shown && zone && zone !== "portal" && zone !== "exit" && (
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

      <ReportDialog targetType="GYM_GUESTBOOK" targetId={reportId ?? 0} open={reportId !== null} onClose={() => setReportId(null)} />

      <div className={`gm-dock-cap ${loggedIn ? "" : "gm-dock-cap-guest"}`} data-fab-avoid>
        <span className="gm-dock-title">바로 가기</span>
        {loggedIn ? (
          <span className="gm-cap-actions">
            {!editing && (
              <button type="button" className={`gm-decor-btn ${bookOpen ? "on" : ""}`} onClick={bookOpen ? () => setBookOpen(false) : openBook} aria-pressed={bookOpen}>
                방명록
                {newEntries > 0 && <i className="font-num">{newEntries}</i>}
              </button>
            )}
            <button type="button" className={`gm-decor-btn ${editing ? "on" : ""}`} onClick={editing ? endEdit : startEdit} aria-pressed={editing}>
              {editing ? "꾸미기 끝" : "꾸미기"}
              {!editing && fresh.length > 0 && <i className="font-num">새 {fresh.length}</i>}
            </button>
          </span>
        ) : (
          <span>자주 쓰는 곳으로 바로</span>
        )}
      </div>
      <nav className="gm-dock" aria-label="바로 가기" data-fab-avoid data-bottom-dock>
        {DOCK.map((d) =>
          "to" in d ? (
            <Link
              key={d.to}
              to={loggedIn ? d.to : "/login"}
              className="gm-dock-btn"
              onClick={() => (loggedIn ? void logEvent("home", "dock_link", { to: d.to }) : signupClick(`dock:${d.to}`))}
            >
              {d.label}
            </Link>
          ) : (
            <button
              key={d.zone}
              type="button"
              className={`gm-dock-btn ${d.zone === "checkin" ? (checkedToday ? "done" : "primary") : ""}`}
              onClick={() => go(d.zone, true)}
            >
              {d.zone === "checkin" ? (checkedToday ? (isGuest ? "체험 완료" : "출석 완료") : isGuest ? "출석 체험" : d.label) : d.label}
            </button>
          ),
        )}
      </nav>
    </div>
  );
}
