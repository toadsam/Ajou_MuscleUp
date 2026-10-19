import { useRef, useState } from "react";

// 던전 조이스틱(docs/design/shadow-dungeon-map.md 2.2) — 왼쪽 아래, 바닥 원 112px + 손잡이 48px.
// 누른 채 끄는 방향으로 onChange(x, y)(-1~1, 길이 1 이하). 손을 떼면 (0, 0). 고무 매트 · 원판 모양(짐 플로어 v2), 블러 · 글로우 없음.

type Props = { onChange: (x: number, y: number) => void; disabled?: boolean; size?: number };

export default function Joystick({ onChange, disabled = false, size = 112 }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const radius = size / 2 - 18;

  const update = (clientX: number, clientY: number) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > radius) {
      dx = (dx / d) * radius;
      dy = (dy / d) * radius;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / radius, dy / radius);
  };

  const release = () => {
    pointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="조이스틱 — 누른 채 끌면 그 방향으로 걸어요"
      className={`relative touch-none select-none rounded-full border-[3px] border-steel-950 bg-steel-800/90 ${disabled ? "opacity-40" : ""}`}
      style={{ width: size, height: size, boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.35)" }}
      onPointerDown={(e) => {
        if (disabled) return;
        pointerRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerRef.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => pointerRef.current !== null && release()}
    >
      {/* 방향 눈금 */}
      {[0, 90, 180, 270].map((deg) => (
        <span
          key={deg}
          className="absolute left-1/2 top-1/2 h-2 w-1 -translate-x-1/2 bg-steel-500"
          style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(${-(size / 2 - 9)}px)` }}
          aria-hidden="true"
        />
      ))}
      {/* 손잡이: 빨간 원판 */}
      <span
        className="absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-steel-950 bg-plate-red"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`, boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.25)" }}
        aria-hidden="true"
      >
        <span className="h-3.5 w-3.5 rounded-full border-2 border-steel-950 bg-steel-900" />
      </span>
    </div>
  );
}
