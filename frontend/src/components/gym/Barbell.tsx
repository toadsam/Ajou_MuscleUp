import { useEffect, useState } from "react";
import type React from "react";
import { PLATE_ORDER, barbellWeight, type PlateSpec } from "./plates";

// 바벨 게이지 — 진행 상황을 원판으로 보여주는 짐 플로어(v2)의 대표 부품.
// 원판 색은 국제 대회 규격(빨강 25 · 파랑 20 · 노랑 15 · 초록 10 · 흰색 5)을 따른다.
// 무거운 원판이 안쪽, 가벼운 원판이 바깥쪽에 끼워지고, 아직 안 끼운 칸은 점선으로 남는다.

type BarbellProps = {
  /** 끼운 원판 수(한쪽 기준). plateList 를 주면 쓰지 않는다 */
  loaded?: number;
  /** 원판 칸 수(한쪽 기준), 최대 7 */
  slots?: number;
  /** 큰 원판의 높이(px) */
  height?: number;
  label?: string;
  className?: string;
  /** 원판이 끼워질 때 애니메이션 */
  animate?: boolean;
  /** 누르면 바벨을 한 번 들어 올린다 */
  liftable?: boolean;
  /** 실제로 끼운 원판(한쪽, 안쪽부터). 주면 loaded · slots 대신 이 원판만 그린다 */
  plateList?: PlateSpec[];
};

const INK = "#0E0E10";

export default function Barbell({
  loaded = 0,
  slots = PLATE_ORDER.length,
  height = 150,
  label,
  className = "",
  animate = true,
  liftable = false,
  plateList,
}: BarbellProps) {
  const [lifting, setLifting] = useState(false);

  useEffect(() => {
    if (!lifting) return;
    const timer = window.setTimeout(() => setLifting(false), 750);
    return () => window.clearTimeout(timer);
  }, [lifting]);
  const specs = plateList ?? PLATE_ORDER.slice(0, Math.min(slots, PLATE_ORDER.length));
  const count = plateList ? plateList.length : Math.max(0, Math.min(loaded, specs.length));

  const makePlates = (side: "left" | "right") =>
    specs.map((spec, index) => {
      const on = index < count;
      const h = Math.round(height * spec.scale);
      // 작게 그릴 때(운동 세션)도 원판 색이 보이게 최소 폭을 둔다
      const w = Math.max(plateList ? 11 : 7, Math.round(spec.width * (height / 150)));
      return (
        <span
          // 끼우는 순간 다시 그려서 등장 애니메이션이 매번 재생되게 한다
          key={`${side}-${spec.kg}-${index}-${on ? "on" : "off"}`}
          title={on ? `${spec.kg}kg` : undefined}
          className={`grid flex-none place-items-center overflow-hidden rounded ${on && animate ? "dg-plate-in" : ""}`}
          style={
            {
              width: w,
              height: h,
              background: on ? spec.color : "transparent",
              border: on ? `3px solid ${INK}` : "3px dashed #55585F",
              "--from": side === "left" ? "-36px" : "36px",
              animationDelay: `${index * 90}ms`,
            } as React.CSSProperties
          }
        >
          {on && w >= 16 && (
            <span className="font-num text-[13px] leading-none" style={{ color: spec.ink, writingMode: "vertical-rl" }}>
              {spec.kg}
            </span>
          )}
        </span>
      );
    });

  const hub = (
    <span
      className="flex-none rounded"
      style={{ width: 11, height: Math.round(height * 0.34), background: "#8E9197", border: `3px solid ${INK}` }}
    />
  );
  const tip = (
    <span
      className="min-w-[8px] flex-1 rounded"
      style={{ height: Math.max(16, Math.round(height * 0.14)), background: "#B8BBC0", border: `3px solid ${INK}` }}
    />
  );

  const ariaLabel = label ?? `원판 ${count}장 / ${specs.length}장, 바벨 ${barbellWeight(count, specs.length)}kg`;
  const Wrapper = liftable ? "button" : "div";

  return (
    <Wrapper
      {...(liftable
        ? { type: "button" as const, onClick: () => setLifting(true), "aria-label": `${ariaLabel}. 눌러서 들어 올리기` }
        : { role: "img", "aria-label": ariaLabel })}
      className={`flex w-full items-center ${liftable ? "dg-chalk-burst cursor-pointer" : ""} ${lifting ? "dg-lift-rep" : ""} ${className}`.trim()}
      style={{ height }}
    >
      {tip}
      {makePlates("left").reverse()}
      {hub}
      <span
        className="min-w-[70px] flex-[1_1_200px] rounded-sm"
        style={{
          height: Math.max(12, Math.round(height * 0.09)),
          border: `3px solid ${INK}`,
          background: "repeating-linear-gradient(60deg, #9A9DA3 0 3px, #7B7E84 3px 6px)",
        }}
      />
      {hub}
      {makePlates("right")}
      {tip}
    </Wrapper>
  );
}
