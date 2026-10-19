import { useEffect, useRef, useState } from "react";
import { gradeOf, type ShadowGrade } from "../../lib/shadow";

// 타이밍 게이지(docs/design/shadow-dungeon.md 2.4): 바벨 위를 원판이 왼쪽→오른쪽으로 0.8초 한 번 미끄러진다.
// 가운데 링을 지날 때 탭 — ±6% PERFECT · ±15% GOOD · 그 밖 MISS. 안 누르면 끝에서 MISS. 탭 자리는 게이지 전체(한 손).

type Props = {
  /** 켜지면 처음부터 미끄러진다(값이 바뀔 때마다 새로) */
  runKey: number | null;
  durationMs?: number;
  onResult: (grade: ShadowGrade, position: number) => void;
};

export default function TimingGauge({ runKey, durationMs = 800, onResult }: Props) {
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<number | null>(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (runKey === null) {
      setRunning(false);
      setStopped(null);
      return;
    }
    doneRef.current = false;
    setStopped(null);
    setRunning(true);
    startRef.current = performance.now();
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setRunning(false);
      setStopped(1);
      onResultRef.current("MISS", 1);
    }, durationMs + 60);
    return () => window.clearTimeout(timer);
  }, [runKey, durationMs]);

  const tap = () => {
    if (!running || doneRef.current) return;
    doneRef.current = true;
    const position = Math.min(1, (performance.now() - startRef.current) / durationMs);
    setRunning(false);
    setStopped(position);
    onResultRef.current(gradeOf(position), position);
  };

  const active = runKey !== null;
  const grade = stopped !== null ? gradeOf(stopped) : null;

  return (
    <button
      type="button"
      onPointerDown={tap}
      disabled={!running}
      className={`relative block h-14 w-full select-none overflow-hidden rounded-sm ${active ? "dg-well" : "border border-dashed border-steel-700"}`}
      aria-label={running ? "지금 탭하면 타이밍 보너스" : "기술을 고르면 타이밍 게이지가 움직여요"}
    >
      {active ? (
        <>
          {/* 바벨 봉 · 가운데 링(GOOD ±15% · PERFECT ±6%) */}
          <span className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 bg-steel-500" aria-hidden="true" />
          <span className="absolute left-1/2 top-1/2 h-10 w-[30%] -translate-x-1/2 -translate-y-1/2 border-x-2 border-chalk/40" aria-hidden="true" />
          <span className="absolute left-1/2 top-1/2 h-10 w-[12%] -translate-x-1/2 -translate-y-1/2 border-x-[3px] border-plate-yellow" aria-hidden="true" />
          {/* 미끄러지는 원판 */}
          <span
            key={runKey}
            className={`absolute top-1/2 h-9 w-5 -translate-y-1/2 rounded-sm border-[3px] border-steel-950 bg-plate-red ${running ? "dg-gauge-slide" : ""}`}
            style={{ left: `calc(${(stopped ?? 0) * 100}% - 10px)`, animationDuration: `${durationMs}ms`, animationPlayState: running ? "running" : "paused" }}
            aria-hidden="true"
          />
          <span className={`absolute right-2 top-1 font-num text-xs ${grade === "PERFECT" ? "text-plate-yellow" : grade === "GOOD" ? "text-chalk" : "text-steel-400"}`}>
            {grade ?? "탭!"}
          </span>
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-num text-sm uppercase tracking-widest text-steel-500">아래 원판을 눌러 기술을 쓰세요</span>
      )}
    </button>
  );
}
