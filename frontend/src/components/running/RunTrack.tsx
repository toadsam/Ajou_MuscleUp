import { useEffect, useState } from "react";
import type React from "react";
import AvatarRenderer from "../avatar/AvatarRenderer";
import type { StageCharacter } from "../workout/LiftStage";

// 러닝 중 "같이 달리는 캐릭터". 지금 페이스가 빠를수록 다리를 빨리 놀리고 바닥 줄이 빨리 흐른다.
// 다음 1km 깃발이 오른쪽에서 다가와 1km 를 채우는 순간 캐릭터를 지나간다. 멈춤이면 선 채로 숨을 고른다.
// 움직임 줄이기 설정이면 멈춘 그림만.

const AVATAR_X = 22; // 캐릭터가 서 있는 곳(왼쪽에서 %)

const reducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

type Props = {
  character: StageCharacter | null;
  mbti?: string | null;
  /** 지금 페이스(초/km). 모르면 null */
  pace: number | null;
  paused: boolean;
  distanceM: number;
};

export default function RunTrack({ character, mbti, pace, paused, distanceM }: Props) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const [reduce] = useState(reducedMotion);
  // 5'00"/km 면 한 걸음 150ms, 7'00" 면 210ms. 페이스를 모르면 보통 속도
  const stepMs = Math.round(Math.min(360, Math.max(120, (pace ?? 390) * 0.5)));

  useEffect(() => {
    if (paused || reduce) {
      setFrame(0);
      return;
    }
    const t = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), stepMs);
    return () => window.clearInterval(t);
  }, [paused, reduce, stepMs]);

  const nextKm = Math.floor(distanceM / 1000) + 1;
  const left = 1000 - (distanceM % 1000); // 다음 1km 까지 남은 m
  const flagX = AVATAR_X + (left / 1000) * (100 - AVATAR_X - 6);

  return (
    <div className="dg-well relative h-[118px] overflow-hidden" role="img" aria-label={paused ? "멈춰서 숨 고르는 캐릭터" : "같이 달리는 캐릭터"}>
      {/* 바닥 줄: 달리는 속도만큼 왼쪽으로 흐른다 */}
      <div
        className={`run-ground absolute inset-x-0 bottom-3 h-[6px] ${paused || reduce ? "" : "run-ground-move"}`}
        style={{ "--run-dur": `${Math.max(0.35, stepMs / 260)}s` } as React.CSSProperties}
        aria-hidden="true"
      />
      {/* 다음 1km 깃발 */}
      <div className="absolute bottom-3 flex flex-col items-center transition-[left] duration-1000 ease-linear" style={{ left: `${flagX}%` }} aria-hidden="true">
        <span className="rounded-sm border-2 border-steel-950 bg-plate-yellow px-1 font-num text-xs leading-tight text-steel-950">{nextKm}km</span>
        <span className="h-9 w-[3px] bg-steel-300" />
      </div>
      <div className="absolute bottom-2" style={{ left: `${AVATAR_X}%`, transform: "translateX(-50%)" }}>
        {character ? (
          <AvatarRenderer
            avatarSeed={character.avatarSeed}
            tier={character.tier}
            stage={character.evolutionStage}
            growthParams={character.growthParams}
            bodyStage={character.bodyStage}
            gender={character.gender}
            mbti={mbti}
            size={80}
            action={paused ? null : { kind: "run", frame, equip: "none", plates: [] }}
          />
        ) : null}
      </div>
      {paused && <span className="absolute right-3 top-2 text-xs text-plate-yellow">숨 고르는 중</span>}
    </div>
  );
}
