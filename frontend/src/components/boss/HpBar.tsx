import { useEffect, useRef, useState } from "react";

// 그림자 체력 바 — 고무 매트 홈(.dg-well)에 빨간 원판 색이 차 있다.
// 격투 게임 체력 바처럼: 맞는 순간 빨강은 바로 깎이고, 초크색 잔상이 0.5초 뒤따라 내려온다. 숫자는 0.25초에 맞춰 내려간다.

type Props = {
  hp: number;
  /** 지금 남은 체력 — 바뀌는 순간 빨강이 바로 깎인다 */
  value: number;
  label?: string;
};

function useTween(to: number, duration: number) {
  const [value, setValue] = useState(to);
  const fromRef = useRef(to);
  const frameRef = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(frameRef.current);
    const from = fromRef.current;
    if (from === to || document.hidden) {
      fromRef.current = to;
      setValue(to);
      return;
    }
    const begin = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setValue(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [to, duration]);
  return value;
}

export default function HpBar({ hp, value, label = "그림자 HP" }: Props) {
  const safeHp = Math.max(1, hp);
  const shown = useTween(value, 250);
  // 잔상: 한 박자(120ms) 뒤에 따라 내려온다
  const [lag, setLag] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setLag(value), 120);
    return () => window.clearTimeout(t);
  }, [value]);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / safeHp) * 100));
  const low = pct(value) <= 25;

  return (
    <div className="space-y-1" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={safeHp} aria-valuenow={value}>
      <div className="flex items-baseline justify-between">
        <span className="font-num text-sm uppercase tracking-wide text-steel-300">{label}</span>
        <span className="font-num text-xl leading-none">
          <span className={low ? "text-plate-red" : "text-white"}>{shown.toLocaleString()}</span>
          <span className="text-steel-500"> / {safeHp.toLocaleString()}</span>
        </span>
      </div>
      <div className="dg-well relative h-5 overflow-hidden">
        <div className="dg-hp-ghost absolute inset-y-0 left-0 bg-chalk/80" style={{ width: `${pct(lag)}%` }} aria-hidden="true" />
        <div className={`absolute inset-y-0 left-0 bg-plate-red ${value === 0 ? "dg-hp-empty" : ""}`} style={{ width: `${pct(value)}%` }} />
        {/* 25 · 50 · 75% 눈금 — 헬스장 바닥 테이프처럼 */}
        {[25, 50, 75].map((tick) => (
          <span key={tick} className="absolute inset-y-0 w-px bg-steel-950/70" style={{ left: `${tick}%` }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
