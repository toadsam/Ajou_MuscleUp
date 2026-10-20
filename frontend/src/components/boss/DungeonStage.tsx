import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AvatarRenderer from "../avatar/AvatarRenderer";
import type { PixelAction, PixelPlate } from "../avatar/pixelAvatar";
import type { StageCharacter } from "../workout/LiftStage";
import HpBar from "./HpBar";
import ImpactMark, { FloorCrack } from "./ImpactMark";
import ShadowSprite from "./ShadowSprite";
import { bodyStageFor } from "../avatar/spriteShape";
import MobSprite from "../dungeon/MobSprite";
import { SHARDS, buildOf, prefersReducedMotion, splitShares } from "./fightParts";
import { spawnChalk } from "../../lib/chalkBurst";
import { SKILL_META, type ShadowHit, type ShadowSkill } from "../../lib/shadow";

// 던전 무대(docs/design/shadow-dungeon.md 5.2 · 5.3). 무대 · 두 캐릭터 · 체력 바는 계속 떠 있고, strike 응답(hit)이 올 때마다 한 기술을 연출한다.
//   지진(LEGS)      점프 → 착지, 바닥 균열 + 무대 크게 흔들림, 그림자가 떠올랐다 떨어짐
//   밀어내기(CHEST) 돌진 → 그림자가 멀리 밀려나 벽에 부딪힘(먼지)
//   들어 던지기(BACK) 1타 들어 올림(그림자가 떠 있음) → 2타 내려찍기 + 흔들림
//   연타(ARMS)      짧은 잽 4번, 작은 숫자 연속
//   돌진(RUN)       그림자를 뚫고 지나감(잔상 3장), 반대편에서 돌아옴
// 타마다 히트스톱 · 타격 자국 · 색 반전 · 조각 숫자. 끝나면 합계 쾅 + 등급 도장(PERFECT! · GOOD · MISS) + 치명타 도장.
// 처치면 4단계 무너짐 → 조각 10개 → DOWN. 동작 하나 ≤ 700ms. 소리 없음.

type Props = {
  character: StageCharacter | null;
  mbti?: string | null;
  hp: number;
  /** 연출이 없을 때 보여 줄 남은 체력 */
  remaining: number;
  /** 지금 연출할 타(없으면 서 있음) */
  hit: ShadowHit | null;
  /** 값이 바뀌면 hit 를 처음부터 연출 */
  playKey: number;
  /** 기술을 고르고 타이밍을 재는 동안 내 캐릭터가 힘주는 자세 */
  windup: ShadowSkill | null;
  /** 그림자가 이미 쓰러져 있음(처치 연출 뒤 · 들어왔을 때 이미 처치) */
  down: boolean;
  /** 들어올 때 그림자가 어둠에서 걸어 나온다 */
  entering?: boolean;
  plates?: PixelPlate[];
  onDone?: (hit: ShadowHit) => void;
  /** 상대: 그림자(기본) 또는 잡몹(지도판 — 그림은 components/dungeon/mobArt) */
  foe?: { kind: "boss" } | { kind: "mob"; code: string };
  /** 체력 바 이름(기본 "그림자 HP") */
  hpLabel?: string;
};

type Phase = "idle" | "fight" | "slam" | "collapse" | "shatter" | "done";
const ORDER: Phase[] = ["idle", "fight", "slam", "collapse", "shatter", "done"];

type Strike = { index: number; share: number; heavy: boolean; last: boolean };

/** 기술별 한 타 길이 · 닿는 시점 */
function timing(fx: string, heavy: boolean) {
  if (fx === "jab") return { total: 300 + (heavy ? 100 : 0), contact: 150 };
  if (fx === "dash") return { total: 720, contact: 340 };
  if (fx === "quake") return { total: 760, contact: 380 };
  return { total: 640 + (heavy ? 140 : 0), contact: 300 };
}

const GRADE_STYLE: Record<string, string> = {
  PERFECT: "bg-plate-yellow text-steel-950 border-steel-950",
  GOOD: "bg-chalk text-steel-950 border-steel-950",
  MISS: "bg-steel-700 text-steel-200 border-steel-950",
};
const GRADE_TEXT: Record<string, string> = { PERFECT: "PERFECT!", GOOD: "GOOD", MISS: "MISS" };

export default function DungeonStage({ character, mbti, hp, remaining, hit, playKey, windup, down, entering = false, plates = [], onDone, foe = { kind: "boss" }, hpLabel }: Props) {
  const reduce = useRef(prefersReducedMotion()).current;
  const [phase, setPhase] = useState<Phase>("idle");
  const [strike, setStrike] = useState<Strike | null>(null);
  const [swing, setSwing] = useState(false);
  const [contact, setContact] = useState<Strike | null>(null);
  const [quake, setQuake] = useState<"soft" | "hard" | null>(null);
  const [crack, setCrack] = useState(false);
  const [dust, setDust] = useState(false);
  const [hpValue, setHpValue] = useState(remaining);
  const [dash, setDash] = useState(60);
  const [through, setThrough] = useState(220);
  const myRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const skill = hit?.skill ?? windup ?? null;
  const meta = skill ? SKILL_META[skill] : null;
  const fx = meta?.fx ?? "push";
  const at = (p: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(p);
  const playing = hit !== null && phase !== "done" && phase !== "idle";

  // 연출이 없을 때는 서버가 준 남은 체력을 그대로
  useEffect(() => {
    if (!hit || phase === "done" || phase === "idle") setHpValue(remaining);
  }, [remaining, hit, phase]);

  // 돌진 거리: 내 칸 오른쪽 끝에서 그림자 칸 왼쪽 끝까지 · 관통 거리: 그림자 너머까지
  useEffect(() => {
    const me = myRef.current?.getBoundingClientRect();
    const sh = shadowRef.current?.getBoundingClientRect();
    const st = stageRef.current?.getBoundingClientRect();
    if (me && sh) setDash(Math.max(24, sh.left - me.right + 18));
    if (me && st) setThrough(Math.max(120, st.right - me.right + 40));
  }, [playKey, phase, windup]);

  // 한 타의 진행표
  useEffect(() => {
    if (!hit) {
      setPhase("idle");
      setStrike(null);
      setContact(null);
      setSwing(false);
      return;
    }
    if (reduce) {
      setPhase("done");
      setHpValue(hit.hpAfter);
      onDoneRef.current?.(hit);
      return;
    }
    const timers: number[] = [];
    const plan = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const f = hit.skill ? SKILL_META[hit.skill].fx : "push";
    const shares = hit.shares.length > 0 ? hit.shares : [hit.damage];
    const n = shares.length;
    const hpShares = splitShares(hit.hpBefore - hit.hpAfter, n);

    setPhase("fight");
    setStrike(null);
    setContact(null);
    setSwing(false);
    setQuake(null);
    setCrack(false);
    setDust(false);
    setHpValue(hit.hpBefore);

    let t = 60;
    for (let i = 0; i < n; i += 1) {
      const last = i === n - 1;
      const heavy = last && (hit.crit || n > 1 || f === "quake" || f === "push");
      const s: Strike = { index: i, share: shares[i], heavy, last };
      const loss = hpShares[i];
      const tm = timing(f, heavy);
      plan(t, () => {
        setStrike(s);
        setSwing(false);
        setContact(null);
      });
      plan(t + Math.round(tm.contact * 0.45), () => setSwing(true));
      plan(t + tm.contact, () => {
        setContact(s);
        const hard = f === "quake" || (f === "lift" && last) || (hit.crit && last);
        setQuake(hard ? "hard" : f === "jab" ? null : "soft");
        if (f === "quake") setCrack(true);
        if (f === "push" && last) setDust(true);
        setHpValue((v) => Math.max(0, v - loss));
        if (hit.crit && last) {
          const box = shadowRef.current?.getBoundingClientRect();
          if (box) spawnChalk(box.left + box.width * 0.35, box.top + box.height * 0.45);
        }
      });
      plan(t + tm.contact + (heavy ? 260 : 200), () => setQuake(null));
      t += tm.total;
      plan(t, () => {
        setStrike(null);
        setSwing(false);
      });
    }
    plan(t, () => {
      setPhase("slam");
      setContact(null);
      setCrack(false);
      setDust(false);
    });
    t += 560;
    if (hit.killed) {
      plan(t, () => setPhase("collapse"));
      t += 480;
      plan(t, () => setPhase("shatter"));
      t += 640;
    }
    plan(t, () => {
      setPhase("done");
      setHpValue(hit.hpAfter);
      onDoneRef.current?.(hit);
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, hit?.id, reduce]);

  const myAction: PixelAction | undefined = useMemo(() => {
    if (down && !playing) return { kind: "flex", frame: 1, equip: "none", plates: [] };
    if (!meta) return undefined;
    if (windup && !hit) return { kind: meta.kind, frame: 0, equip: meta.equip, plates: meta.equip === "barbell" ? plates : [] };
    if (playing) return { kind: meta.kind, frame: swing ? 1 : 0, equip: meta.equip, plates: meta.equip === "barbell" ? plates : [] };
    return undefined;
  }, [down, playing, meta, windup, hit, swing, plates]);

  const shadowAction: PixelAction | null = useMemo(() => (meta ? { kind: meta.kind, frame: 1, equip: meta.equip, plates: [] } : null), [meta]);

  const shadowGone = down || (hit?.killed === true && at("shatter"));
  const showSlam = hit !== null && at("slam");

  // 내 캐릭터 움직임(타마다 새로 시작하도록 key 를 바꾼다)
  const myFx = strike
    ? fx === "quake"
      ? "dg-jump"
      : fx === "dash"
        ? "dg-through"
        : fx === "jab"
          ? "dg-dash dg-dash-jab"
          : strike.heavy
            ? "dg-dash dg-dash-heavy"
            : "dg-dash"
    : "";
  // 그림자 피격
  const shadowFx = contact
    ? fx === "quake"
      ? "dg-launch"
      : fx === "push"
        ? contact.last
          ? "dg-knock-far"
          : "dg-hit"
        : fx === "lift"
          ? contact.last
            ? "dg-slam-down"
            : "dg-lift-up"
          : fx === "dash"
            ? "dg-hit-hard"
            : "dg-hit"
    : phase === "collapse"
      ? "dg-collapse"
      : entering && phase === "idle" && !down
        ? "dg-enter"
        : "";

  return (
    <div
      className={`relative ${quake === "hard" ? "dg-quake-hard" : quake === "soft" ? "dg-quake" : ""}`}
      style={{ "--dash": `${dash}px`, "--through": `${through}px` } as CSSProperties}
    >
      <div ref={stageRef} className="dg-rubber relative overflow-hidden px-2 pt-2">
        {/* 무대: 내 캐릭터 ↔ 그림자, 바닥 테이프 선 */}
        <div className="relative flex h-[160px] items-end justify-between">
          <span className="pointer-events-none absolute inset-x-2 bottom-2 border-t-2 border-dashed border-steel-500/70" aria-hidden="true" />
          {crack && (
            <span className="dg-crack pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2" aria-hidden="true">
              <FloorCrack />
            </span>
          )}

          <div ref={myRef} className="relative z-20 flex h-full w-[112px] flex-none items-end justify-center">
            {/* 돌진 잔상 */}
            {strike && fx === "dash" && character && (
              <>
                {[0, 1, 2].map((i) => (
                  <span key={`ghost-${playKey}-${strike.index}-${i}`} className="dg-ghost absolute bottom-0 left-0 right-0 flex justify-center" style={{ animationDelay: `${i * 70}ms` }} aria-hidden="true">
                    <AvatarRenderer avatarSeed={character.avatarSeed} tier={character.tier} stage={character.evolutionStage} growthParams={character.growthParams} bodyStage={character.bodyStage} gender={character.gender} mbti={mbti} size={100} action={myAction} />
                  </span>
                ))}
              </>
            )}
            <div key={strike ? `fx-${playKey}-${strike.index}` : `idle-${windup ?? "none"}`} className={myFx}>
              {character ? (
                <AvatarRenderer
                  avatarSeed={character.avatarSeed}
                  tier={character.tier}
                  stage={character.evolutionStage}
                  growthParams={character.growthParams}
                  bodyStage={character.bodyStage}
                  gender={character.gender}
                  mbti={mbti}
                  size={100}
                  action={myAction}
                  pumped={down}
                />
              ) : (
                <span className="pb-6 text-xs text-steel-500">캐릭터 불러오는 중</span>
              )}
            </div>
          </div>

          {/* 가운데: 합계 · 등급 · 치명타 도장 */}
          <div className="relative z-30 flex flex-1 flex-col items-center justify-center self-center text-center">
            {showSlam && hit ? (
              <>
                <p key={`slam-${playKey}`} className="dg-slam leading-none">
                  <span className={`dg-ink-shadow block font-num text-6xl ${hit.crit ? "text-plate-yellow" : "text-white"}`}>
                    {hit.damage > 0 ? `+${hit.damage.toLocaleString()}` : "0"}
                  </span>
                </p>
                {hit.grade && (
                  <span key={`grade-${playKey}`} className={`dg-stamp mt-1 inline-block -rotate-6 border-[3px] px-2 font-num text-lg leading-tight ${GRADE_STYLE[hit.grade]}`}>
                    {GRADE_TEXT[hit.grade]}
                  </span>
                )}
                {hit.crit && (
                  <span key={`crit-${playKey}`} className="dg-stamp mt-1 inline-block rotate-3 border-[3px] border-steel-950 bg-plate-yellow px-2 font-display text-lg leading-tight text-steel-950" style={{ animationDelay: "120ms" }}>
                    치명타!
                  </span>
                )}
              </>
            ) : windup && !hit ? (
              <span className="font-display text-xl text-plate-yellow">{SKILL_META[windup].label}</span>
            ) : (
              <span className="font-num text-2xl text-steel-600">VS</span>
            )}
          </div>

          <div ref={shadowRef} className="relative z-10 flex h-full w-[112px] flex-none items-end justify-center">
            {!shadowGone && foe.kind === "mob" && (
              <MobSprite key={contact ? `mob-${playKey}-${contact.index}` : `mob-${playKey}-${phase}-${entering}`} code={foe.code} size={84} className={shadowFx} />
            )}
            {!shadowGone && foe.kind === "boss" && (
              <ShadowSprite
                key={contact ? `sh-${playKey}-${contact.index}` : `sh-${playKey}-${phase}-${entering}`}
                avatarSeed={character?.avatarSeed ?? "shadow"}
                build={buildOf(character)}
              bodyStage={character ? bodyStageFor(character) : null}
                female={character?.gender === "FEMALE"}
                action={shadowAction}
                size={100}
                className={shadowFx}
              />
            )}
            {dust && (
              <span className="pointer-events-none absolute inset-y-6 right-0 z-30" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <i key={`dust-${playKey}-${i}`} className="dg-dust absolute right-0 block bg-steel-400" style={{ top: `${10 + i * 22}%`, width: 6 + (i % 2) * 2, height: 6 + (i % 2) * 2, animationDelay: `${i * 40}ms` }} />
                ))}
              </span>
            )}
            {contact && (
              <span key={`impact-${playKey}-${contact.index}`} className="dg-impact pointer-events-none absolute left-1 top-[38%] z-30 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                <ImpactMark size={fx === "jab" ? 40 : 56} />
              </span>
            )}
            {contact && (
              <span
                key={`float-${playKey}-${contact.index}`}
                className={`dg-float pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 font-num ${contact.heavy ? "text-3xl" : fx === "jab" ? "text-xl" : "text-2xl"} ${hit?.crit && contact.last ? "text-plate-yellow" : "text-white"}`}
                style={fx === "jab" ? { marginLeft: `${(contact.index % 2 === 0 ? -1 : 1) * 14}px` } : undefined}
                aria-hidden="true"
              >
                {contact.share > 0 ? `+${contact.share}` : "0"}
              </span>
            )}
            {hit?.killed && at("shatter") && !down && (
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
              <span key={`down-${playKey}`} className="dg-stamp dg-ink-shadow absolute bottom-6 left-1/2 z-30 -translate-x-1/2 -rotate-6 border-[3px] border-chalk px-2 font-num text-4xl leading-none text-chalk">
                DOWN
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <HpBar hp={hp} value={hpValue} label={hpLabel} />
      </div>
    </div>
  );
}
