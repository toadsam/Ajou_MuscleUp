import { useEffect, useState, type ComponentProps } from "react";
import AvatarRenderer from "./AvatarRenderer";
import type { ChibiExpression } from "./chibiArt";
import type { PixelAction } from "./pixelAvatar";

// 누르면 반응하는 내 캐릭터(2026-10-20) — 홈 "캐릭터 미리보기". 누를 때마다 알통 자랑 → 윙크 → 펄쩍 순서로 1.4초씩.
// 쉬는 중이면 몸은 그대로 두고 말만 한다.

type Reaction = { action?: PixelAction; expression?: ChibiExpression; celebrate?: boolean; say: string };

const FLEX: PixelAction = { kind: "flex", frame: 1, equip: "none", plates: [] };
const REACTIONS: Reaction[] = [
  { action: FLEX, celebrate: true, say: "알통 봐!" },
  { expression: "wink", say: "오늘도 득근!" },
  { expression: "smile", celebrate: true, say: "가보자!" },
];
const RESTING: Reaction = { say: "쉬는 중이에요" };

type Props = ComponentProps<typeof AvatarRenderer>;

export default function TapAvatar(props: Props) {
  const [taps, setTaps] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setActive(false), 1400);
    return () => window.clearTimeout(id);
  }, [active, taps]);

  const r = props.isResting ? RESTING : REACTIONS[(taps - 1 + REACTIONS.length) % REACTIONS.length];
  const react = active ? { action: r.action ?? props.action, expression: r.expression, celebrate: r.celebrate } : {};

  return (
    <button
      type="button"
      className="relative block cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-plate-yellow"
      aria-label="캐릭터 누르기"
      onClick={() => {
        setTaps((n) => n + 1);
        setActive(true);
      }}
    >
      {/* 누를 때마다 다시 그려 펄쩍 · 반짝을 처음부터 */}
      <AvatarRenderer key={active ? `react-${taps}` : "idle"} {...props} {...react} />
      {active && (
        <span
          key={`say-${taps}`}
          className="dg-pop pointer-events-none absolute right-0 top-[22%] translate-x-1/4 whitespace-nowrap border-2 border-black bg-chalk px-2 py-0.5 text-xs font-bold text-black"
          role="status"
        >
          {r.say}
        </span>
      )}
    </button>
  );
}
