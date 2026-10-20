import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import AvatarRenderer from "../avatar/AvatarRenderer";
import type { PixelAction } from "../avatar/pixelAvatar";
import type { StageCharacter } from "../workout/LiftStage";
import type { FightMotion } from "./BossFight";
import DungeonDoor from "./DungeonDoor";
import HpBar from "./HpBar";
import { PlateIcon } from "./SkillPlates";
import { prefersReducedMotion } from "./fightParts";
import { DUNGEON_PATH, SHADOW_DAILY_CAP, SKILLS, SKILL_META, STRIKE_CHUNK, type ShadowCharge } from "../../lib/shadow";

// 충전 연출 — 운동 · 러닝 결과 화면 맨 위(docs/design/shadow-dungeon.md 5.4). 1차 전투 장면 자리.
// 내 캐릭터가 오늘 동작 1회 → 통별 원판이 던전 문으로 날아가 쌓임 → "하체 +40 · 가슴 +25" → 치명타 토큰이면 초크 통 → [던전 가서 쓰기]. 1.2초.

type Props = {
  charge: ShadowCharge;
  character: StageCharacter | null;
  mbti?: string | null;
  motion: FightMotion;
};

export default function ChargeScene({ charge, character, mbti, motion }: Props) {
  const reduce = useRef(prefersReducedMotion()).current;
  const [swing, setSwing] = useState(false);
  const [flying, setFlying] = useState(reduce);
  const [landed, setLanded] = useState(reduce);
  const [fly, setFly] = useState(160);
  const myRef = useRef<HTMLDivElement | null>(null);
  const doorRef = useRef<HTMLDivElement | null>(null);

  const charged = SKILLS.filter((s) => (charge.charged[s] ?? 0) > 0).map((s) => ({ skill: s, amount: charge.charged[s] ?? 0 }));
  // 날아가는 원판: 통마다 하나, 큰 통은 60 마다 하나 더(최대 5)
  const plates = charged.flatMap(({ skill, amount }) => Array.from({ length: Math.max(1, Math.min(3, Math.ceil(amount / STRIKE_CHUNK))) }, () => skill)).slice(0, 5);

  useEffect(() => {
    const me = myRef.current?.getBoundingClientRect();
    const door = doorRef.current?.getBoundingClientRect();
    if (me && door) setFly(Math.max(60, door.left + door.width / 2 - (me.left + me.width / 2)));
  }, []);

  useEffect(() => {
    if (reduce) return;
    const timers = [
      window.setTimeout(() => setSwing(true), 180),
      window.setTimeout(() => {
        setSwing(false);
        setFlying(true);
      }, 460),
      window.setTimeout(() => setLanded(true), 460 + 360 + plates.length * 70),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [reduce, plates.length]);

  const action: PixelAction = { kind: motion.kind, frame: swing ? 1 : 0, equip: motion.equip, plates: motion.plates ?? [] };
  const nothing = charge.total <= 0;

  return (
    <section className="dg-rubber relative overflow-hidden p-4" aria-label={`그림자 던전 힘 모으기 — ${charge.total}`} style={{ "--fly": `${fly}px` } as CSSProperties}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-num text-xs uppercase tracking-[0.2em] text-steel-400">Shadow dungeon</p>
          <h2 className="font-display text-2xl leading-none text-white">힘 모으기</h2>
        </div>
        <span className="dg-chip font-num text-sm">통 {charge.chargeTotal}</span>
      </header>

      <div className="relative mt-2 flex h-[140px] items-end justify-between px-1">
        <span className="pointer-events-none absolute inset-x-2 bottom-2 border-t-2 border-dashed border-steel-500/70" aria-hidden="true" />
        <div ref={myRef} className="relative z-20 flex h-full w-[104px] flex-none items-end justify-center">
          {character ? (
            <AvatarRenderer avatarSeed={character.avatarSeed} tier={character.tier} stage={character.evolutionStage} growthParams={character.growthParams} bodyStage={character.bodyStage} gender={character.gender} mbti={mbti} size={96} action={action} />
          ) : (
            <span className="pb-6 text-xs text-steel-500">캐릭터 불러오는 중</span>
          )}
          {/* 날아가는 원판 */}
          {flying && !landed && (
            <span className="pointer-events-none absolute bottom-10 left-1/2 z-30" aria-hidden="true">
              {plates.map((skill, i) => (
                <i key={i} className="dg-fly absolute" style={{ animationDelay: `${i * 70}ms`, marginLeft: -14 }}>
                  <PlateIcon skill={skill} size={28} />
                </i>
              ))}
            </span>
          )}
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center self-center text-center">
          <span className={`dg-ink-shadow font-num text-5xl leading-none ${landed ? "dg-slam" : "opacity-0"} ${charge.critToken ? "text-plate-yellow" : "text-white"}`}>
            {nothing ? "0" : `+${charge.total}`}
          </span>
          <span className="mt-1 font-num text-xs uppercase tracking-widest text-steel-400">모음</span>
        </div>

        <div ref={doorRef} className="relative z-10 flex h-full w-[104px] flex-none flex-col items-center justify-end">
          <DungeonDoor size={56} />
          {/* 문 앞에 쌓인 원판 */}
          {landed && (
            <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden="true">
              {plates.map((skill, i) => (
                <i key={i} className="dg-pop block" style={{ animationDelay: `${i * 40}ms` }}>
                  <PlateIcon skill={skill} size={18} />
                </i>
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <HpBar hp={charge.hp} value={charge.remaining} />
      </div>

      {/* 통별 · 토큰 · 상한 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {charged.map(({ skill, amount }) => (
          <span key={skill} className="dg-chip flex items-center gap-1.5">
            <PlateIcon skill={skill} size={14} />
            {SKILL_META[skill].pool} <b className="font-num text-sm text-white">+{amount}</b>
          </span>
        ))}
        {charge.critToken && <span className="dg-chip border-plate-yellow/70 text-plate-yellow">치명타 토큰 +1</span>}
        {charge.capped && <span className="dg-chip text-steel-300">오늘 {SHADOW_DAILY_CAP} 다 모았어요</span>}
      </div>
      {nothing ? (
        <p className="mt-2 text-sm text-steel-300">오늘 넣을 수 있는 힘 {SHADOW_DAILY_CAP}을 이미 다 모았어요. 내일 다시 쌓여요.</p>
      ) : (
        <p className="mt-2 text-sm text-steel-300">
          {charge.killed ? "이번 주 그림자는 이미 쓰러졌어요. 던전에서 쓰면 오버킬로 들어가요." : `던전에서 기술로 쏘세요. 지금 통에 ${charge.chargeTotal}, 치명타 토큰 ${charge.critTokens}개.`}
        </p>
      )}
      <Link to={DUNGEON_PATH} className="dg-btn dg-btn-primary mt-3 min-h-[44px] w-full text-sm">
        던전 가서 쓰기 →
      </Link>
    </section>
  );
}
