import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// 숫자를 이전 값에서 목표 값까지 굴려 올린다. start 가 false 면 0 에서 기다린다.
export function useCountUp(target: number | null | undefined, { duration = 900, start = true } = {}) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target === null || target === undefined || Number.isNaN(target) || !start) return;
    // 탭이 숨겨져 있으면 requestAnimationFrame 이 돌지 않아 0 에 머문다 → 바로 목표 값으로
    if (prefersReducedMotion() || document.hidden) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const begin = performance.now();
    let frame = 0;
    // 애니메이션이 중간에 멈춰도(탭 전환 등) 결국 목표 값이 보이게 하는 안전장치
    const settle = window.setTimeout(() => {
      fromRef.current = target;
      setValue(target);
    }, duration + 150);
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target, duration, start]);

  return value;
}
