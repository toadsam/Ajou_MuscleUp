import { useEffect, useState } from "react";
import AvatarRenderer from "../avatar/AvatarRenderer";
import { api } from "../../lib/api";
import { barbellLoad, motionFor } from "../../lib/liftMotion";
import type { LiveItem } from "../../lib/live";
import type { LiftExerciseInfo } from "../../lib/lifts";

// 라운지 "운동 구역" — 지금 운동 세션 · 러닝 중인 사람의 캐릭터가 그 종목 동작을 한다(GET /api/live, 20초마다).
// 운동하는 사람은 라운지에 접속해 있지 않아서, 서버가 기억해 둔 "운동 중" 목록으로 보여 준다.
// 화면에는 닉네임 · 종목 이름 · 캐릭터만(무게 · 이메일 없음). 움직임 줄이기 설정이면 멈춘 그림.

const POLL_MS = 20_000;

const reducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

const infoOf = (item: LiveItem): LiftExerciseInfo | null =>
  item.exercise && item.label && item.category
    ? { code: item.exercise, label: item.label, category: item.category, bigThree: false, bodyweight: item.bodyweight }
    : null;

export default function LiveZone() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [frame, setFrame] = useState<0 | 1>(0);
  const [reduce] = useState(reducedMotion);

  useEffect(() => {
    let alive = true;
    const load = (first = false) => {
      if (!first && document.visibilityState === "hidden") return; // 다른 탭에 가 있으면 다시 부르지 않는다
      api
        .get<{ count: number; items: LiveItem[] }>("/api/live")
        .then((res) => {
          if (!alive) return;
          setItems(Array.isArray(res.data.items) ? res.data.items : []);
          setCount(res.data.count ?? 0);
        })
        .catch(() => undefined)
        .finally(() => alive && setLoaded(true));
    };
    load(true);
    const t = window.setInterval(() => load(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // 모두 같은 박자로 천천히 반복
  useEffect(() => {
    if (reduce || items.length === 0) return;
    const t = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 800);
    return () => window.clearInterval(t);
  }, [reduce, items.length]);

  return (
    <section className="dg-steel space-y-3 p-4" aria-label="운동 구역">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">운동 구역</h2>
        <span className="dg-chip bg-plate-red text-xs text-white">지금 운동 중 {count}명</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-steel-400">
          {loaded ? "지금 운동 중인 사람이 없어요. 운동 세션이나 러닝을 시작하면 여기에 나와요." : "불러오는 중이에요."}
        </p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const info = infoOf(item);
            const motion = item.activity === "RUN" ? { kind: "run" as const, equip: "none" as const } : motionFor(info);
            return (
              <li key={`${item.nickname}-${item.since}`} className={`dg-well flex w-[104px] flex-none flex-col items-center gap-1 p-2 ${item.mine ? "ring-2 ring-plate-yellow" : ""}`}>
                <div className="flex h-[84px] w-full items-end justify-center overflow-hidden">
                  <AvatarRenderer
                    avatarSeed={item.avatarSeed}
                    tier={item.tier}
                    stage={item.evolutionStage}
                    growthParams={item.growthParams}
                    gender={item.gender}
                    tank={item.tank}
                    pumped={item.isPumped}
                    size={64}
                    action={{ kind: motion.kind, frame, equip: motion.equip, plates: motion.equip === "barbell" ? barbellLoad(60).pixel : [] }}
                  />
                </div>
                <p className="w-full truncate text-center text-xs font-semibold text-chalk">{item.mine ? "나" : item.nickname}</p>
                <p className="w-full truncate text-center text-[11px] text-steel-400">
                  {item.activity === "RUN" ? "러닝 중" : (item.label ?? "운동 중")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
