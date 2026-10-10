import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CharacterTier } from "./types";

type Props = {
  active: boolean;
  tier: CharacterTier;
  children: React.ReactNode;
};

const isMasterOrHigher = (tier: CharacterTier) =>
  tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";

// 초크 가루가 한 점에서 퍼진다. index.css 의 .dg-chalk-layer 모양·애니메이션을 그대로 빌려 쓰고
// 위치만 부모 기준(absolute)으로 바꾼다. 렌더마다 값이 바뀌지 않게 난수 대신 인덱스로 흩뿌린다.
export function ChalkPuff({
  count = 14,
  spread = 56,
  x = "50%",
  y = "50%",
}: {
  count?: number;
  spread?: number;
  x?: string;
  y?: string;
}) {
  const dots = Array.from({ length: count }, (_, i) => {
    const jitter = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const angle = (Math.PI * 2 * i) / count + jitter * 0.6;
    const distance = spread * (0.45 + jitter * 0.55);
    return {
      "--dx": `${Math.cos(angle) * distance}px`,
      "--dy": `${Math.sin(angle) * distance - 10}px`,
      "--s": `${3 + jitter * 5}px`,
      animationDelay: `${(i % 4) * 30}ms`,
    } as CSSProperties;
  });

  return (
    <div aria-hidden="true" className="dg-chalk-layer" style={{ position: "absolute", left: x, top: y, zIndex: 5 }}>
      {dots.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  );
}

// 티어가 오르면 원판이 바벨에 '철컥' 끼워지듯 아바타가 옆에서 밀려 들어오고, 초크 가루가 퍼진다.
export default function TierUpAnimation({ active, tier, children }: Props) {
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!active) return;
    setPlaying(true);
    setRound((prev) => prev + 1);
    const timer = window.setTimeout(() => setPlaying(false), 900);
    return () => window.clearTimeout(timer);
  }, [active, tier]);

  const high = isMasterOrHigher(tier);

  return (
    <div className="relative">
      <div
        key={round}
        className={playing ? "dg-plate-in" : ""}
        style={playing ? ({ "--from": "-36px" } as CSSProperties) : undefined}
      >
        {children}
      </div>
      {playing && (
        <>
          {/* 바닥에 원판이 닿는 순간 생기는 노란 원판 테두리 */}
          <span
            aria-hidden="true"
            className="dg-pop pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] rounded-full border-[3px] border-plate-yellow opacity-70"
            style={{ translate: "-50% -50%" }}
          />
          <ChalkPuff key={`puff-${round}`} count={high ? 22 : 14} spread={high ? 84 : 58} y="70%" />
        </>
      )}
    </div>
  );
}
