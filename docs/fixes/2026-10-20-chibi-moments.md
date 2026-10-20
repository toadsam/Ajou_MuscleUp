# 2026-10-20 · 출석 축하 점프 · 티어가 오르는 순간 · 민소매 갈아입기 — 코드 단위 기록

요약은 [fix-log](../fix-log.md) 같은 날 항목. 앞 단계: [자세 · 반응](2026-10-20-chibi-emotes.md).

## 출석 축하(`gymMap/engine.ts celebrate`)

- `cheerUntil = now + 640` → 그동안 `pose: "cheer"`, `hop = round(sin(진행 / 320ms × π) × 4)`(두 번 점프), 점프가 높을 때 주먹이 위(장면 1).
- 그다음 `overUntil = now + 640 + 1700` 까지 바벨 머리 위로(예전 그대로). 원판 비행(0.68초)은 점프와 같이 시작.
- 움직임 줄이기(`reduce`): 점프 없이 바로 든다.
- 홈 카드(`TapAvatar`): `showReaction`(출석 직후 2.4초) 동안 `action: flex 1` + `celebrate`.

## 성장 순간 창 순서

홈: `TierUp`(끝나면 `onDone`) → `BodyStageUp`. 보여 줄 게 없으면 `TierUp` 이 바로 `onDone` 을 불러 다음으로.

```ts
// "이 기기에서 지난번 본 값" 기억 — 성장 순간 창(몸이 커졌어요 · 티어가 올랐어요)이 같은 것을 두 번 띄우지 않게.
// localStorage { [아바타 시드]: 값 }. 저장 못 하는 브라우저(사생활 보호 창)면 다음에 또 보일 뿐이다.

export const readSeen = (key: string): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
};

export const rememberSeen = (key: string, seedKey: string, value: number) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...readSeen(key), [seedKey]: value }));
  } catch {
    // 저장 못 함 — 다음에 한 번 더 보인다
  }
};

/** 지난번 본 값보다 올랐으면 그 값(창을 띄운다), 아니면 null */
export const risenFrom = (key: string, seedKey: string, value: number): number | null => {
  const prev = readSeen(key)[seedKey];
  return typeof prev === "number" && value > prev ? prev : null;
};
```

```tsx
import { useEffect, useState, type ReactNode } from "react";
import DialogFrame from "../DialogFrame";
import { tierStepOf } from "./chibiArt";
import { rememberSeen, risenFrom } from "./seenStore";

// 티어가 오르는 순간(2026-10-20) — 홈에서 티어가 이 기기에서 지난번 본 것보다 오르면 한 번 보여 준다.
// 예전 티어 모습이 떨리다가 새 장비를 찬 모습이 튀어나오고(BodyStageUp 과 같은 움직임), 새로 얻은 장비 이름을 적는다.
// 끝나면(또는 보여 줄 게 없으면) onDone — 홈은 그다음에 "몸이 커졌어요"를 띄운다(창이 겹치지 않게).

const KEY = "tier_seen_v1";
const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
/** 티어 단계마다 하나씩 차는 장비(chibiArt 티어 장비와 같은 순서) */
const GEAR = ["", "손목 보호대", "벨트", "무릎 보호대", "머리띠", "금 버클", "금 벨트", "금 신발"];

type Props = {
  seedKey: string;
  tier: string;
  /** 그 티어로 그린 내 캐릭터 */
  renderAvatar: (tier: string, size: number) => ReactNode;
  onDone?: () => void;
};

export default function TierUp({ seedKey, tier, renderAvatar, onDone }: Props) {
  const step = tierStepOf(tier);
  const [from] = useState<number | null>(() => risenFrom(KEY, seedKey, step));
  const [open, setOpen] = useState(from !== null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (from === null) {
      rememberSeen(KEY, seedKey, step); // 처음 보거나 그대로 · 내려감: 조용히 기억하고 다음 순서로
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setGrown(true), 700);
    return () => window.clearTimeout(id);
    // onDone 은 처음 한 번만 부르면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, seedKey, step]);

  if (from === null || !open) return null;
  const close = () => {
    rememberSeen(KEY, seedKey, step);
    setOpen(false);
    onDone?.();
  };
  const gained = GEAR.slice(from + 1, step + 1).filter(Boolean);

  return (
    <DialogFrame open onClose={close} title="티어가 올랐어요" description={`${TIERS[from] ?? ""} → ${tier}`}>
      <div className="relative mx-auto mt-2 flex h-[168px] w-[168px] items-end justify-center" aria-hidden="true">
        {grown ? (
          <div key="new" className="pxa-grow-new">
            {renderAvatar(tier, 156)}
          </div>
        ) : (
          <div key="old" className="pxa-grow-old">
            {renderAvatar(TIERS[from] ?? "BRONZE", 156)}
          </div>
        )}
      </div>
      <p className="mt-3 text-center font-num text-2xl uppercase text-plate-yellow">{tier}</p>
      {gained.length > 0 && <p className="mt-1 text-center text-sm text-steel-300">새 장비: {gained.join(" · ")}</p>}
      <button type="button" className="dg-btn dg-btn-primary mt-4 min-h-[44px] w-full" onClick={close}>
        좋아요
      </button>
    </DialogFrame>
  );
}
```

## 민소매 갈아입기(`pages/Collection.tsx`)

- `applyEquipped` 에서 민소매가 바뀌면 `turn + 1` → 내 모습 묶음 `key={turn}` + `pxa-turn`(0.6초, `scaleX` 1 → 0.15 → -1 → 0.15 → 1, 6칸 끊어서).
- 내 모습 `AvatarRenderer` 에 `tank={view.equipped.tank}`(서버 장착값)를 넘긴다.

## diff

```diff
diff --git a/frontend/src/components/avatar/BodyStageUp.tsx b/frontend/src/components/avatar/BodyStageUp.tsx
index ccedb1e..5efe689 100644
--- a/frontend/src/components/avatar/BodyStageUp.tsx
+++ b/frontend/src/components/avatar/BodyStageUp.tsx
@@ -1,6 +1,7 @@
 import { useEffect, useState, type ReactNode } from "react";
 import DialogFrame from "../DialogFrame";
 import { BODY_STAGE_NAMES } from "./chibiArt";
+import { rememberSeen, risenFrom } from "./seenStore";
 
 // 몸이 커지는 순간(2026-10-20) — 홈에서 몸 단계(서버 BodyStage)가 이 기기에서 지난번 본 값보다 오르면 한 번 보여 준다.
 // 예전 몸이 떨리다가(0.7초) 새 몸이 튀어나온다(0.6초). 처음 보는 기기는 지금 값을 기억만 하고 띄우지 않는다.
@@ -8,23 +9,6 @@ import { BODY_STAGE_NAMES } from "./chibiArt";
 
 const KEY = "body_stage_seen_v1";
 
-const readSeen = (): Record<string, number> => {
-  try {
-    const v = JSON.parse(localStorage.getItem(KEY) || "{}") as unknown;
-    return v && typeof v === "object" ? (v as Record<string, number>) : {};
-  } catch {
-    return {};
-  }
-};
-
-const remember = (seedKey: string, stage: number) => {
-  try {
-    localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), [seedKey]: stage }));
-  } catch {
-    // 저장 못 하는 브라우저(사생활 보호 창)면 다음에 또 보일 뿐이다
-  }
-};
-
 type Props = {
   /** 캐릭터마다 따로 기억(아바타 시드) */
   seedKey: string;
@@ -36,16 +20,13 @@ type Props = {
 
 export default function BodyStageUp({ seedKey, stage, renderAvatar }: Props) {
   // 캐릭터를 불러온 뒤에 붙인다(key 로 다시 만든다) — 처음 값만 보면 된다
-  const [from] = useState<number | null>(() => {
-    const prev = readSeen()[seedKey];
-    return typeof prev === "number" && stage > prev ? prev : null;
-  });
+  const [from] = useState<number | null>(() => risenFrom(KEY, seedKey, stage));
   const [open, setOpen] = useState(from !== null);
   const [grown, setGrown] = useState(false);
 
   useEffect(() => {
     if (from === null) {
-      remember(seedKey, stage); // 처음 보거나 그대로 · 내려감: 조용히 기억
+      rememberSeen(KEY, seedKey, stage); // 처음 보거나 그대로 · 내려감: 조용히 기억
       return;
     }
     const id = window.setTimeout(() => setGrown(true), 700);
@@ -54,7 +35,7 @@ export default function BodyStageUp({ seedKey, stage, renderAvatar }: Props) {
 
   if (from === null || !open) return null;
   const close = () => {
-    remember(seedKey, stage);
+    rememberSeen(KEY, seedKey, stage);
     setOpen(false);
   };
   const name = (s: number) => `단계 ${s} · ${BODY_STAGE_NAMES[s] ?? ""}`;
diff --git a/frontend/src/components/avatar/avatar.css b/frontend/src/components/avatar/avatar.css
index 8091c0b..a5bb9d9 100644
--- a/frontend/src/components/avatar/avatar.css
+++ b/frontend/src/components/avatar/avatar.css
@@ -267,6 +267,19 @@
   100% { transform: scale(1); filter: none; }
 }
 
+/* 민소매를 갈아입는 순간(도감): 제자리에서 한 바퀴 돈다(0.6초) */
+.pxa-turn {
+  animation: pxa-turn 0.6s steps(6, end) both;
+}
+
+@keyframes pxa-turn {
+  0% { transform: scaleX(1); }
+  25% { transform: scaleX(0.15); }
+  50% { transform: scaleX(-1); }
+  75% { transform: scaleX(0.15); }
+  100% { transform: scaleX(1); }
+}
+
 /* 몬스터를 쓰러뜨린 순간: 한 번 펄쩍(0.6초) */
 .avatar-victory > svg {
   animation: avatar-victory 0.6s ease-out both;
diff --git a/frontend/src/components/gymMap/engine.ts b/frontend/src/components/gymMap/engine.ts
index 2dbab3d..e06d3f4 100644
--- a/frontend/src/components/gymMap/engine.ts
+++ b/frontend/src/components/gymMap/engine.ts
@@ -768,6 +768,9 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
   let shownPlates = state.plates;
   const player: Walker = { x: START[0], y: START[1], path: [], speed: WALK_SPEED, anim: 0, moving: false, back: true };
   let overUntil = 0;
+  /** 출석 축하: 바를 들기 전에 화이팅 자세로 두 번 점프(0.64초) */
+  let cheerUntil = 0;
+  const CHEER_MS = 640;
   type Npc = { id: NpcId; w: Walker; wait: number; route: number; talkUntil: number };
   const allNpcs: Npc[] = (Object.keys(NPC_PLANS) as NpcId[]).map((id) => {
     const p = NPC_PLANS[id];
@@ -1041,7 +1044,10 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
 
     const px = Math.round(player.x * TILE + 3);
     const py = Math.round(player.y * TILE) - 1;
-    const over = now < overUntil;
+    const cheering = now < cheerUntil;
+    const over = !cheering && now < overUntil;
+    // 점프: 0.32초에 한 번씩 4칸 높이 포물선
+    const jump = cheering ? Math.round(Math.sin((((now - (cheerUntil - CHEER_MS)) % 320) / 320) * Math.PI) * 4) : 0;
     // 기구 앞에 멈춰 서면 운동: 파워랙 스쿼트 · 거울 알통 · 러닝머신 제자리 달리기(1층에서만)
     const gear = main && !player.moving && !over && (zone === "rack" || zone === "mirror" || zone === "crew") ? zone : null;
     const walk = gear === "crew" ? walkPose(now / 90, true, now) : walkPose(player.anim * 12, player.moving && !over, now);
@@ -1062,13 +1068,13 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
         fill(g, px + 1, py + 17, 8, 1, C.yellow);
         g.globalAlpha = 1;
         drawChar(g, px, py, pal, {
-          frame: over ? 0 : walk.frame,
-          back: !over && !gear && player.back,
+          frame: over || cheering ? 0 : walk.frame,
+          back: !over && !cheering && !gear && player.back,
           over,
-          hop: gearPose ? 0 : walk.hop,
-          squash: !over && !gearPose && walk.squash,
-          pose: gearPose,
-          poseFrame: gearFrame,
+          hop: cheering ? jump : gearPose ? 0 : walk.hop,
+          squash: !over && !cheering && !gearPose && walk.squash,
+          pose: cheering ? "cheer" : gearPose,
+          poseFrame: cheering ? (jump > 1 ? 1 : 0) : gearFrame,
         });
       },
     });
@@ -1187,7 +1193,9 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
       shownPlates = Math.max(0, state.plates - 1);
       player.path = [];
       [player.x, player.y] = ZONES.checkin.anchor;
-      overUntil = performance.now() + 1700;
+      // 화이팅 점프 두 번 → 바벨 번쩍(움직임 줄이기면 바로 든다)
+      cheerUntil = reduce ? 0 : performance.now() + CHEER_MS;
+      overUntil = performance.now() + (reduce ? 0 : CHEER_MS) + 1700;
       puff(player.x * TILE + 8, player.y * TILE + 2, 10);
       flights.push({
         t0: performance.now(),
diff --git a/frontend/src/pages/Collection.tsx b/frontend/src/pages/Collection.tsx
index fdcd82f..1be1420 100644
--- a/frontend/src/pages/Collection.tsx
+++ b/frontend/src/pages/Collection.tsx
@@ -66,6 +66,8 @@ function ItemPreview({ item, size = "md" }: { item: Pick<CollectionItemView, "ca
 
 export default function Collection() {
   const [view, setView] = useState<CollectionView | null>(null);
+  /** 민소매를 갈아입을 때마다 1씩 — 내 모습이 한 바퀴 도는 장면을 다시 튼다 */
+  const [turn, setTurn] = useState(0);
   const [character, setCharacter] = useState<MyCharacter | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [tab, setTab] = useState<CollectionCategory>("TITLE");
@@ -97,6 +99,8 @@ export default function Collection() {
   }, [load]);
 
   const applyEquipped = (equipped: Equipped) => {
+    // 민소매가 바뀌면 내 모습이 한 바퀴 돌며 갈아입는다
+    if ((view?.equipped.tank ?? null) !== (equipped.tank ?? null)) setTurn((n) => n + 1);
     setView((v) => (v ? { ...v, equipped } : v));
     syncEquippedTank(character?.avatarSeed, equipped.tank);
   };
@@ -213,7 +217,7 @@ export default function Collection() {
             <div className="dg-rubber relative flex h-[150px] w-[120px] flex-none items-end justify-center overflow-hidden rounded-lg border-[3px] border-black">
               <div aria-hidden="true" className="dg-platform absolute inset-x-0 bottom-0 h-6" />
               {character && (
-                <div className="relative z-[1] mb-5">
+                <div key={turn} className={`relative z-[1] mb-5 ${turn ? "pxa-turn" : ""}`}>
                   <AvatarRenderer
                     avatarSeed={character.avatarSeed}
                     tier={character.tier}
@@ -221,6 +225,7 @@ export default function Collection() {
                     growthParams={character.growthParams}
                     bodyStage={character.bodyStage}
                     gender={character.gender}
+                    tank={view.equipped.tank}
                     size={104}
                   />
                 </div>
diff --git a/frontend/src/pages/Home.tsx b/frontend/src/pages/Home.tsx
index 5e393fb..a0b5208 100644
--- a/frontend/src/pages/Home.tsx
+++ b/frontend/src/pages/Home.tsx
@@ -3,6 +3,7 @@ import { Link } from "react-router-dom";
 import AvatarRenderer from "../components/avatar/AvatarRenderer";
 import { bodyStageFor, spriteShapeOf } from "../components/avatar/spriteShape";
 import BodyStageUp from "../components/avatar/BodyStageUp";
+import TierUp from "../components/avatar/TierUp";
 import TapAvatar from "../components/avatar/TapAvatar";
 import { toneForMbti } from "../components/gymMap/engine";
 import CountUp from "../components/gym/CountUp";
@@ -184,6 +185,8 @@ export default function Home() {
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [showReaction, setShowReaction] = useState(false);
+  // 성장 순간 창 순서: 티어 → 몸 단계
+  const [tierSeen, setTierSeen] = useState(false);
   const [activeEvents, setActiveEvents] = useState<EventItem[]>([]);
   const [eventIndex, setEventIndex] = useState(0);
   const [isEventPaused, setIsEventPaused] = useState(false);
@@ -432,6 +435,9 @@ export default function Home() {
               pumped={(character.pumpedUntil ?? 0) > Date.now()}
               tank={character.tank}
               size={170}
+              // 출석한 순간: 알통 자랑 + 펄쩍
+              action={showReaction ? { kind: "flex", frame: 1, equip: "none", plates: [] } : undefined}
+              celebrate={showReaction}
             />
           </div>
         ) : (
@@ -497,6 +503,28 @@ export default function Home() {
 
           <div className="hero-map dg-rubber">
             {character && (
+              // 티어가 지난번 본 것보다 오르면 "티어가 올랐어요" — 끝나면 몸 단계 창(겹치지 않게 차례로)
+              <TierUp
+                key={`tier-${character.avatarSeed}`}
+                seedKey={character.avatarSeed}
+                tier={character.tier}
+                onDone={() => setTierSeen(true)}
+                renderAvatar={(t, size) => (
+                  <AvatarRenderer
+                    avatarSeed={character.avatarSeed}
+                    growthParams={character.growthParams}
+                    bodyStage={character.bodyStage}
+                    tier={t as typeof character.tier}
+                    stage={character.evolutionStage}
+                    gender={character.gender}
+                    mbti={mbti}
+                    tank={character.tank}
+                    size={size}
+                  />
+                )}
+              />
+            )}
+            {character && tierSeen && (
               // 몸 단계가 지난번 본 값보다 오르면 "몸이 커졌어요"(펌핑은 빼고)
               <BodyStageUp
                 key={character.avatarSeed}
```
