import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import AvatarRenderer from "../avatar/AvatarRenderer";
import type { ActionKind, Equip, PixelAction, PixelPlate } from "../avatar/pixelAvatar";
import type { StageCharacter } from "../workout/LiftStage";
import HpBar from "./HpBar";
import ShadowSprite from "./ShadowSprite";
import { bodyStageFor } from "../avatar/spriteShape";
import { spawnChalk } from "../../lib/chalkBurst";
import { SHADOW_DAILY_CAP, SOURCE_LABEL, type ShadowHit } from "../../lib/shadow";

// 전투 장면 — 운동 · 러닝 결과 화면 맨 위(docs/design/shadow-boss.md 5.1). 격투 게임 문법으로:
//   공격  내 캐릭터가 뒤로 움츠렸다 그림자까지 돌진 → 닿는 순간 멈칫(히트스톱) + 타격 자국 + 그림자 색 반전 · 넉백 → 체력 바가 바로 깎이고
//         초크색 잔상이 따라 내려온다 → 맞은 자리 위로 "+힘" 조각이 뜬다. 힘이 클수록 2~3연타, 마지막 타는 세게.
//   치명타 마지막 타에 초크 가루 + 무대가 크게 흔들림 + "치명타!" 도장
//   처치  모든 타가 끝나면 그림자가 4단계로 무너짐 → 원판 조각이 흩어지고 "DOWN" 도장 → 전리품 카드 → 내 캐릭터 알통
// 건너뛰기는 늘 보인다(마지막 상태로). 소리 없음(헬스장). 동작 하나는 ≤600ms.

export type FightMotion = { kind: ActionKind; equip: Equip; plates?: PixelPlate[] };

type Props = {
  hit: ShadowHit;
  character: StageCharacter | null;
  mbti?: string | null;
  /** 오늘 대표 동작(운동은 첫 종목, 러닝은 run) */
  motion: FightMotion;
  /** 값이 바뀌면 처음부터 다시 본다 */
  replayKey?: number;
  /** 전리품 카드의 버튼을 숨긴다(그림자 화면 안에서 다시 볼 때) */
  noLinks?: boolean;
};

type Stage = "ready" | "fight" | "slam" | "collapse" | "shatter" | "done";
const ORDER: Stage[] = ["ready", "fight", "slam", "collapse", "shatter", "done"];

/** 한 타의 길이: 움츠림 140 → 돌진 160 → 히트스톱 90 → 넉백 · 복귀 250 */
const STRIKE_MS = 640;
const HEAVY_EXTRA_MS = 140;
const CONTACT_AT = 300;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** AvatarRenderer 와 같은 셈으로 내 근육 단계를 구해 그림자도 같은 덩치로 */
function buildOf(character: StageCharacter | null): 0 | 1 | 2 | 3 {
  const g = character?.growthParams;
  if (!g) return 1;
  const score = clamp01(g.muscularityNormalized) * 2.4 + clamp01(g.shoulderGrowth) * 0.6;
  return Math.max(0, Math.min(3, Math.floor(score + 0.3))) as 0 | 1 | 2 | 3;
}

/** 힘이 클수록 여러 번 때린다: ~39 한 번 · ~99 두 번 · 그 위 세 번 */
function strikeCount(hit: ShadowHit) {
  if (hit.damage <= 0) return 1;
  return hit.damage < 40 ? 1 : hit.damage < 100 ? 2 : 3;
}

/** total 을 n 조각으로(앞은 작게, 마지막이 가장 크게 — 마지막 타가 세게 들어가도록). 합은 정확히 total */
function split(total: number, n: number) {
  if (n <= 1) return [total];
  const weights = n === 2 ? [0.4, 0.6] : [0.25, 0.3, 0.45];
  const out = weights.map((w) => Math.floor(total * w));
  out[n - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

/** 조각이 날아가는 방향(원판 색 순서대로) */
const SHARDS = [
  { dx: -58, dy: -44, rot: -140, color: "#D9302A", s: 14 },
  { dx: 52, dy: -56, rot: 160, color: "#2F6FD0", s: 12 },
  { dx: -36, dy: 14, rot: -70, color: "#F0BE2E", s: 10 },
  { dx: 44, dy: 10, rot: 100, color: "#2E9C55", s: 12 },
  { dx: -14, dy: -70, rot: 50, color: "#9A9DA3", s: 8 },
  { dx: 20, dy: 24, rot: -220, color: "#D9302A", s: 10 },
  { dx: -70, dy: -10, rot: 80, color: "#2F6FD0", s: 8 },
  { dx: 66, dy: -22, rot: -110, color: "#F0BE2E", s: 8 },
  { dx: 6, dy: -40, rot: 200, color: "#EEECE6", s: 6 },
  { dx: -24, dy: -24, rot: -30, color: "#EEECE6", s: 6 },
];

/** 타격 자국: 픽셀 별 모양(초크 흰색 + 잉크 테두리) */
function ImpactMark() {
  const rays = [
    [18, 0, 4, 10],
    [18, 30, 4, 10],
    [0, 18, 10, 4],
    [30, 18, 10, 4],
    [6, 6, 6, 6],
    [28, 6, 6, 6],
    [6, 28, 6, 6],
    [28, 28, 6, 6],
  ];
  return (
    <svg viewBox="0 0 40 40" width="56" height="56" shapeRendering="crispEdges" aria-hidden="true">
      {rays.map(([x, y, w, h], i) => (
        <rect key={i} x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill="#0E0E10" />
      ))}
      {rays.map(([x, y, w, h], i) => (
        <rect key={`w${i}`} x={x} y={y} width={w} height={h} fill="#F4F2EC" />
      ))}
      <rect x={16} y={16} width={8} height={8} fill="#0E0E10" />
      <rect x={17} y={17} width={6} height={6} fill="#F0BE2E" />
    </svg>
  );
}

type Strike = { index: number; share: number; heavy: boolean };

export default function BossFight({ hit, character, mbti, motion, replayKey = 0, noLinks = false }: Props) {
  const reduce = useRef(prefersReducedMotion()).current;
  const [stage, setStage] = useState<Stage>(reduce ? "done" : "ready");
  const [strike, setStrike] = useState<Strike | null>(null); // 지금 돌진 중인 타
  const [swing, setSwing] = useState(false); // 내 캐릭터 프레임 1(힘주는 자세)
  const [contact, setContact] = useState<Strike | null>(null); // 닿은 순간(타격 자국 · 넉백 · 조각 숫자)
  const [quake, setQuake] = useState<"soft" | "hard" | null>(null);
  const [hpValue, setHpValue] = useState(hit.hpBefore);
  const [dash, setDash] = useState(0);
  const myRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);

  const at = (s: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(s);
  const killed = hit.killed;
  const alreadyDown = hit.hpBefore === 0 && !killed;
  const capped = hit.damage === 0 && hit.raw > 0;
  const done = at("done");

  // 돌진 거리: 내 칸 오른쪽 끝에서 그림자 칸 왼쪽 끝까지(무대 폭에 따라)
  useEffect(() => {
    const me = myRef.current?.getBoundingClientRect();
    const sh = shadowRef.current?.getBoundingClientRect();
    if (me && sh) setDash(Math.max(24, sh.left - me.right + 18));
  }, [replayKey, stage]);

  // 장면 진행표
  useEffect(() => {
    if (reduce) {
      setStage("done");
      setHpValue(hit.hpAfter);
      return;
    }
    setStage("ready");
    setStrike(null);
    setSwing(false);
    setContact(null);
    setQuake(null);
    setHpValue(hit.hpBefore);

    const timers: number[] = [];
    const plan = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));

    const n = strikeCount(hit);
    const damageShares = split(hit.damage, n);
    const hpShares = split(hit.hpBefore - hit.hpAfter, n);
    let t = 200;
    plan(t, () => setStage("fight"));
    for (let i = 0; i < n; i += 1) {
      const heavy = i === n - 1 && (hit.crit || n > 1);
      const s: Strike = { index: i, share: damageShares[i], heavy };
      const loss = hpShares[i];
      plan(t, () => {
        setStrike(s);
        setSwing(false);
        setContact(null);
      });
      plan(t + 140, () => setSwing(true));
      plan(t + CONTACT_AT, () => {
        setContact(s);
        setQuake(heavy && hit.crit ? "hard" : "soft");
        setHpValue((v) => Math.max(0, v - loss));
        if (heavy && hit.crit) {
          const box = shadowRef.current?.getBoundingClientRect();
          if (box) spawnChalk(box.left + box.width * 0.35, box.top + box.height * 0.45);
        }
      });
      plan(t + CONTACT_AT + (heavy ? 260 : 200), () => setQuake(null));
      t += STRIKE_MS + (heavy ? HEAVY_EXTRA_MS : 0);
      plan(t, () => {
        setStrike(null);
        setSwing(false);
      });
    }
    plan(t, () => setStage("slam"));
    t += 520;
    if (killed) {
      plan(t, () => setStage("collapse"));
      t += 480;
      plan(t, () => setStage("shatter"));
      t += 640;
    }
    plan(t, () => setStage("done"));
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, hit.id, hit.hpBefore, hit.hpAfter, hit.damage, hit.crit, killed, reduce]);

  const skip = () => {
    setStrike(null);
    setSwing(false);
    setContact(null);
    setQuake(null);
    setHpValue(hit.hpAfter);
    setStage("done");
  };

  const myAction: PixelAction = useMemo(() => {
    if (done && killed) return { kind: "flex", frame: 1, equip: "none", plates: [] };
    return { kind: motion.kind, frame: swing ? 1 : 0, equip: motion.equip, plates: motion.plates ?? [] };
  }, [done, killed, swing, motion.kind, motion.equip, motion.plates]);
  const shadowAction: PixelAction = useMemo(
    () => ({ kind: motion.kind, frame: 1, equip: motion.equip, plates: [] }),
    [motion.kind, motion.equip],
  );

  const shadowGone = killed && at("shatter");
  const showDamage = at("slam");
  const shadowFx = contact ? (contact.heavy ? "dg-hit-hard" : "dg-hit") : stage === "collapse" ? "dg-collapse" : "";

  return (
    <section
      className={`dg-rubber relative overflow-hidden p-4 ${quake === "hard" ? "dg-quake-hard" : quake === "soft" ? "dg-quake" : ""}`}
      aria-label={`주간 보스 그림자 공격 — 힘 ${hit.damage}${hit.crit ? ", 치명타" : ""}${killed ? ", 처치" : ""}`}
      style={{ "--dash": `${dash}px` } as CSSProperties}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-num text-xs uppercase tracking-[0.2em] text-steel-400">Weekly boss</p>
          <h2 className="font-display text-2xl leading-none text-white">그림자</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="dg-chip text-xs">오늘 {SOURCE_LABEL[hit.source]}</span>
          {!done && (
            <button type="button" onClick={skip} className="text-xs text-steel-400 underline underline-offset-4">
              건너뛰기
            </button>
          )}
        </div>
      </header>

      {/* 무대: 내 캐릭터 ↔ 그림자, 바닥 초크 선 */}
      <div className="relative mt-2 flex h-[150px] items-end justify-between px-1">
        <span className="pointer-events-none absolute inset-x-2 bottom-2 border-t-2 border-dashed border-steel-500/70" aria-hidden="true" />

        <div ref={myRef} className="relative z-20 flex h-full w-[118px] flex-none items-end justify-center">
          <div key={strike ? `dash-${replayKey}-${strike.index}` : "idle"} className={strike ? (strike.heavy ? "dg-dash dg-dash-heavy" : "dg-dash") : ""}>
            {character ? (
              <AvatarRenderer
                avatarSeed={character.avatarSeed}
                tier={character.tier}
                stage={character.evolutionStage}
                growthParams={character.growthParams}
                bodyStage={character.bodyStage}
                gender={character.gender}
                mbti={mbti}
                size={104}
                action={myAction}
                pumped={done}
                celebrate={done && killed}
              />
            ) : (
              <span className="pb-6 text-xs text-steel-500">캐릭터 불러오는 중</span>
            )}
          </div>
        </div>

        {/* 가운데: 오늘 힘 — 타가 끝나면 쾅 찍힌다 */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center self-center text-center">
          {showDamage ? (
            <p key={`dmg-${replayKey}`} className="dg-slam leading-none">
              <span className="block font-num text-xs uppercase tracking-widest text-steel-400">오늘 힘</span>
              <span className={`dg-ink-shadow block font-num text-6xl ${hit.crit ? "text-plate-yellow" : "text-white"}`}>
                {hit.damage > 0 ? `+${hit.damage.toLocaleString()}` : "0"}
              </span>
            </p>
          ) : (
            <span className="font-num text-2xl text-steel-600">VS</span>
          )}
          {hit.crit && showDamage && (
            <span key={`crit-${replayKey}`} className="dg-stamp mt-1 inline-block -rotate-6 border-[3px] border-steel-950 bg-plate-yellow px-2 font-display text-xl leading-tight text-steel-950">
              치명타!
            </span>
          )}
        </div>

        <div ref={shadowRef} className="relative z-10 flex h-full w-[118px] flex-none items-end justify-center">
          {!shadowGone && (
            <ShadowSprite
              key={contact ? `fx-${replayKey}-${contact.index}` : `fx-${replayKey}-${stage}`}
              avatarSeed={character?.avatarSeed ?? "shadow"}
              build={buildOf(character)}
              bodyStage={character ? bodyStageFor(character) : null}
              female={character?.gender === "FEMALE"}
              action={shadowAction}
              size={104}
              className={shadowFx}
            />
          )}
          {/* 타격 자국 + 조각 숫자 */}
          {contact && (
            <span key={`impact-${replayKey}-${contact.index}`} className="dg-impact pointer-events-none absolute left-1 top-[38%] z-30 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
              <ImpactMark />
            </span>
          )}
          {contact && (
            <span
              key={`float-${replayKey}-${contact.index}`}
              className={`dg-float pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 font-num ${contact.heavy ? "text-3xl" : "text-2xl"} ${hit.crit && contact.heavy ? "text-plate-yellow" : "text-white"}`}
              aria-hidden="true"
            >
              {contact.share > 0 ? `+${contact.share}` : "0"}
            </span>
          )}
          {killed && at("shatter") && (
            <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
              {SHARDS.map((s, i) => (
                <i
                  key={i}
                  className="dg-shard"
                  style={{ "--dx": `${s.dx}px`, "--dy": `${s.dy}px`, "--rot": `${s.rot}deg`, width: s.s, height: s.s, marginLeft: -s.s / 2, marginTop: -s.s / 2, background: s.color, animationDelay: `${i * 25}ms` } as CSSProperties}
                />
              ))}
            </span>
          )}
          {shadowGone && (
            <span key={`down-${replayKey}`} className="dg-stamp dg-ink-shadow absolute bottom-6 left-1/2 z-30 -translate-x-1/2 -rotate-6 border-[3px] border-chalk px-2 font-num text-4xl leading-none text-chalk">
              DOWN
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <HpBar hp={hit.hp} value={hpValue} />
      </div>

      {/* 상황 문구 */}
      {done && capped && (
        <p className="mt-3 text-sm text-steel-300">
          오늘 넣을 수 있는 힘 {SHADOW_DAILY_CAP}을 다 썼어요(이번 {SOURCE_LABEL[hit.source]} 힘 {hit.raw}). 내일 공격이 다시 들어가요.
        </p>
      )}
      {done && alreadyDown && (
        <p className="mt-3 text-sm text-steel-300">
          이미 쓰러진 그림자예요. 오버킬 <span className="font-num text-base text-plate-yellow">{hit.overkillPct}%</span> — 보상은 다음 주 그림자가 들고 있어요.
        </p>
      )}
      {done && hit.crit && !capped && (
        <p className="mt-3 text-xs text-steel-400">자기 기록을 깨서 치명타 — 힘 {hit.raw}이 {hit.damage}으로 들어갔어요.</p>
      )}

      {/* 전리품 */}
      {done && killed && hit.reward && (
        <div key={`loot-${replayKey}`} className="dg-steel dg-pop mt-4 space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-xl text-plate-yellow">그림자 처치!</h3>
            {hit.overkillPct > 0 && <span className="font-num text-sm text-steel-300">오버킬 {hit.overkillPct}%</span>}
          </div>
          <ul className="grid grid-cols-3 gap-2 text-center">
            <li className="dg-well p-2">
              <span className="block font-num text-2xl text-white">+{hit.reward.points}</span>
              <span className="text-xs text-steel-400">캐릭터 점수</span>
            </li>
            <li className="dg-well p-2">
              <span className="block font-num text-2xl text-white">{hit.reward.box}</span>
              <span className="text-xs text-steel-400">보상 상자</span>
            </li>
            <li className="dg-well p-2">
              <span className="block font-num text-2xl text-white">{hit.reward.titles.length}</span>
              <span className="text-xs text-steel-400">새 칭호</span>
            </li>
          </ul>
          {hit.reward.titles.length > 0 && (
            <p className="text-sm text-steel-200">
              칭호 <strong className="text-plate-yellow">{hit.reward.titles.join(" · ")}</strong>를 얻었어요. 도감에서 달 수 있어요.
            </p>
          )}
          {!noLinks && (
            <div className="flex gap-2">
              <Link to="/collection" className="dg-btn dg-btn-primary min-h-[40px] flex-1 text-sm">
                상자 열기
              </Link>
              <Link to="/shadow" className="dg-btn dg-btn-steel min-h-[40px] flex-1 text-sm">
                이번 주 전적
              </Link>
            </div>
          )}
        </div>
      )}
      {done && killed && !hit.reward && (
        <p className="mt-3 text-sm text-steel-300">그림자를 쓰러뜨렸어요. 이번 주 보상은 이미 받았어요.</p>
      )}
    </section>
  );
}
