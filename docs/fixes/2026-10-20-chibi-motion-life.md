# 2026-10-20 · 캐릭터 움직임 — 코드 단위 기록

요약은 [fix-log](../fix-log.md) 같은 날 항목. 설계: [character-chibi.md](../design/character-chibi.md) 4절 5.

## 작은 그림: `walkPose(cycle, moving, now, seed)` → `drawChar({ frame, hop, squash })`

| 상태 | 박자 | 다리 frame | hop(몸 위로) | squash(머리 내려앉음) |
| --- | --- | --- | --- | --- |
| 걷기 | 0 | 1 | 1 | - |
| 걷기 | 1 | 1 | 0 | 예(착지) |
| 걷기 | 2 | 2 | 1 | - |
| 걷기 | 3 | 2 | 0 | 예 |
| 서기 | 1.6초 주기 | 0 | 0 | 마지막 0.35초 |

- 박자 = `floor(cycle × 2) % 4`. cycle 은 각 지도가 쓰던 걸음 값(홈 `anim × 12` · 직원 `anim × 7` · 광장 · 던전 `step × 8`) 그대로.
- `squash` 는 머리 8줄 + 머리 위 줄을 한 칸 아래로 옮긴다. 몸통 줄이 나중에 칠해져 턱이 어깨 뒤로 묻힌다.
- 숨쉬기 박자는 seed 로 어긋난다: 직원 순서 · 앉은 손님 순서 · 광장은 아이디 마지막 글자.

## 카드 숨쉬기: `AvatarRenderer`

- 동작이 없을 때(`!actionKey`) `art.regions.face` 의 턱 줄 위(`y < face.y + face.h - 1`) 칸을 `<g class="pxa-breathe">` 로 묶는다.
- CSS `pxa-breathe` 2.4초(쉬는 중 3.6초) `steps(1, end)`: 0~72% 제자리 → 72~90% `translateY(6px)`(한 칸) → 제자리.

## 몸이 커지는 순간: `BodyStageUp`

- localStorage `body_stage_seen_v1` = { 아바타 시드: 본 몸 단계 }. 처음 · 같음 · 내려감은 조용히 기억, 오르면 창.
- 홈은 `bodyStageFor({ ...character, pumped: false })`(펌핑 제외)를 넘긴다.

```tsx
import { useEffect, useState, type ReactNode } from "react";
import DialogFrame from "../DialogFrame";
import { BODY_STAGE_NAMES } from "./chibiArt";

// 몸이 커지는 순간(2026-10-20) — 홈에서 몸 단계(서버 BodyStage)가 이 기기에서 지난번 본 값보다 오르면 한 번 보여 준다.
// 예전 몸이 떨리다가(0.7초) 새 몸이 튀어나온다(0.6초). 처음 보는 기기는 지금 값을 기억만 하고 띄우지 않는다.
// 펌핑(+1)은 넘기지 않는다 — 운동 직후마다 "커졌어요"가 뜨지 않게.

const KEY = "body_stage_seen_v1";

const readSeen = (): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const remember = (seedKey: string, stage: number) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), [seedKey]: stage }));
  } catch {
    // 저장 못 하는 브라우저(사생활 보호 창)면 다음에 또 보일 뿐이다
  }
};

type Props = {
  /** 캐릭터마다 따로 기억(아바타 시드) */
  seedKey: string;
  /** 지금 몸 단계 0~5 */
  stage: number;
  /** 몸 단계 b 로 그린 내 캐릭터 */
  renderAvatar: (bodyStage: number, size: number) => ReactNode;
};

export default function BodyStageUp({ seedKey, stage, renderAvatar }: Props) {
  // 캐릭터를 불러온 뒤에 붙인다(key 로 다시 만든다) — 처음 값만 보면 된다
  const [from] = useState<number | null>(() => {
    const prev = readSeen()[seedKey];
    return typeof prev === "number" && stage > prev ? prev : null;
  });
  const [open, setOpen] = useState(from !== null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (from === null) {
      remember(seedKey, stage); // 처음 보거나 그대로 · 내려감: 조용히 기억
      return;
    }
    const id = window.setTimeout(() => setGrown(true), 700);
    return () => window.clearTimeout(id);
  }, [from, seedKey, stage]);

  if (from === null || !open) return null;
  const close = () => {
    remember(seedKey, stage);
    setOpen(false);
  };
  const name = (s: number) => `단계 ${s} · ${BODY_STAGE_NAMES[s] ?? ""}`;

  return (
    <DialogFrame open onClose={close} title="몸이 커졌어요" description={`${name(from)} → ${name(stage)}`}>
      <div className="relative mx-auto mt-2 flex h-[168px] w-[168px] items-end justify-center" aria-hidden="true">
        {grown ? (
          <div key="new" className="pxa-grow-new">
            {renderAvatar(stage, 156)}
          </div>
        ) : (
          <div key="old" className="pxa-grow-old">
            {renderAvatar(from, 156)}
          </div>
        )}
      </div>
      <p className="mt-3 text-center font-display text-lg text-plate-yellow">{name(stage)}</p>
      <p className="mt-1 text-center text-sm text-steel-300">레벨 · 활동 · 근육 중 가장 높은 값이 올라서 어깨와 팔이 더 굵어졌어요.</p>
      <button type="button" className="dg-btn dg-btn-primary mt-4 min-h-[44px] w-full" onClick={close}>
        좋아요
      </button>
    </DialogFrame>
  );
}
```

## 이긴 순간

- `AvatarRenderer celebrate`: 알통(프레임 1) 표정을 `sparkle` 로, 껍데기에 `avatar-victory`(0.6초 펄쩍).
- `DungeonStage`: `celebrate={down && myAction?.kind === "flex"}` · `BossFight`: `celebrate={done && killed}`.

## diff

```diff
diff --git a/frontend/src/components/avatar/AvatarRenderer.tsx b/frontend/src/components/avatar/AvatarRenderer.tsx
index cfc214e..39345ad 100644
--- a/frontend/src/components/avatar/AvatarRenderer.tsx
+++ b/frontend/src/components/avatar/AvatarRenderer.tsx
@@ -36,6 +36,8 @@ type Props = {
    * 치비 그림(chibiArt, 2026-10-20): 서기 · 알통 · 휴식과 정면 운동 동작 9가지. 옆모습 동작(벤치 · 머신 · 러닝 등)은 pixelPoses 가 큰 머리로 그린다.
    */
   bodyStage?: number | null;
+  /** 이긴 순간(몬스터를 쓰러뜨림): 반짝이는 눈 + 한 번 펄쩍 */
+  celebrate?: boolean;
 };
 
 // 피부·머리 색은 MBTI 를 따르고, 민소매 색은 원판 팔레트에서 고른다.
@@ -85,6 +87,7 @@ export default function AvatarRenderer({
   tank = null,
   pumped = false,
   bodyStage = null,
+  celebrate = false,
 }: Props) {
   const [persistedAppearance, setPersistedAppearance] = useState(() => loadAppearanceBySeed(avatarSeed));
 
@@ -158,7 +161,9 @@ export default function AvatarRenderer({
       const expression: ChibiExpression = chibiAct
         ? chibiAct.frame === 1
           ? chibiAct.kind === "flex"
-            ? "smile"
+            ? celebrate
+              ? "sparkle"
+              : "smile"
             : "strain"
           : "normal"
         : resolvedAttendanceRisk !== "normal"
@@ -229,10 +234,16 @@ export default function AvatarRenderer({
     actionKey,
     pumped,
     bodyStage,
+    celebrate,
   ]);
 
   const y = (row: number) => row * CELL;
   const custom = action ? null : resolvedCustomization;
+  // 숨쉬기(치비 서기 · 알통 · 휴식): 턱 위 줄(머리 · 머리카락 · 알통 주먹)만 따로 묶어 한 칸 내려앉았다 올라온다. 운동 동작은 그대로
+  const breatheY = !actionKey ? art.regions.face.y + art.regions.face.h - 1 : null;
+  const cell = (run: { x: number; y: number; w: number; color: string }) => (
+    <rect key={`${run.x}:${run.y}`} x={run.x * CELL} y={y(run.y)} width={run.w * CELL} height={CELL} fill={run.color} />
+  );
   const region = (r: { x: number; y: number; w: number; h: number }) => ({
     x: r.x * CELL,
     y: y(r.y),
@@ -242,7 +253,7 @@ export default function AvatarRenderer({
 
   return (
     <div
-      className={`avatar-shell-v2 ${motionClass} avatar-tier-${tier.toLowerCase()} ${resolvedGender === "FEMALE" ? "avatar-gender-female" : "avatar-gender-male"} ${resolvedResting ? "avatar-resting" : ""} ${resolvedAttendanceRisk === "warning" ? "avatar-risk-warning" : ""} ${resolvedAttendanceRisk === "critical" ? "avatar-risk-critical" : ""} ${tierPreset.burst ? "avatar-master-burst" : ""}`}
+      className={`avatar-shell-v2 ${motionClass} avatar-tier-${tier.toLowerCase()} ${resolvedGender === "FEMALE" ? "avatar-gender-female" : "avatar-gender-male"} ${resolvedResting ? "avatar-resting" : ""} ${resolvedAttendanceRisk === "warning" ? "avatar-risk-warning" : ""} ${resolvedAttendanceRisk === "critical" ? "avatar-risk-critical" : ""} ${tierPreset.burst ? "avatar-master-burst" : ""} ${celebrate ? "avatar-victory" : ""}`}
       style={{ width: size, height: size }}
     >
       {resolvedResting && <div className="avatar-rest-banner">{"휴식 중"}</div>}
@@ -284,16 +295,14 @@ export default function AvatarRenderer({
         {/* 바닥 그림자 */}
         <rect x={4 * CELL} y={y(31)} width={16 * CELL} height={CELL} fill="rgba(0,0,0,0.35)" />
 
-        {art.runs.map((run) => (
-          <rect
-            key={`${run.x}:${run.y}`}
-            x={run.x * CELL}
-            y={y(run.y)}
-            width={run.w * CELL}
-            height={CELL}
-            fill={run.color}
-          />
-        ))}
+        {breatheY === null ? (
+          art.runs.map(cell)
+        ) : (
+          <>
+            {art.runs.filter((run) => run.y >= breatheY).map(cell)}
+            <g className={resolvedResting ? "pxa-breathe pxa-breathe-slow" : "pxa-breathe"}>{art.runs.filter((run) => run.y < breatheY).map(cell)}</g>
+          </>
+        )}
 
         {custom?.body && (
           <image
diff --git a/frontend/src/components/avatar/avatar.css b/frontend/src/components/avatar/avatar.css
index a84008d..8091c0b 100644
--- a/frontend/src/components/avatar/avatar.css
+++ b/frontend/src/components/avatar/avatar.css
@@ -227,6 +227,59 @@
   animation: master-screen-burst 0.9s ease-out;
 }
 
+/* 치비 숨쉬기(2026-10-20): 머리가 한 칸(6) 내려앉았다 올라온다. 칸 단위로 끊어 픽셀이 번지지 않게. 쉬는 중은 느리게 */
+.pxa-breathe {
+  animation: pxa-breathe 2.4s steps(1, end) infinite;
+}
+
+.pxa-breathe-slow {
+  animation-duration: 3.6s;
+}
+
+@keyframes pxa-breathe {
+  0% { transform: translateY(0); }
+  72% { transform: translateY(6px); }
+  90% { transform: translateY(0); }
+}
+
+/* 몸이 커지는 순간(BodyStageUp): 예전 몸이 떨리고 → 새 몸이 아래에서 튀어나온다 */
+.pxa-grow-old {
+  animation: pxa-grow-old 0.7s steps(1, end) both;
+}
+
+@keyframes pxa-grow-old {
+  0% { transform: translateX(0); }
+  20% { transform: translateX(-3px); }
+  40% { transform: translateX(3px); }
+  60% { transform: translateX(-3px) scale(0.96); }
+  80% { transform: translateX(3px) scale(0.92); }
+  100% { transform: translateX(0) scale(0.9); }
+}
+
+.pxa-grow-new {
+  transform-origin: 50% 100%;
+  animation: pxa-grow-new 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) both;
+}
+
+@keyframes pxa-grow-new {
+  0% { transform: scale(0.75); filter: brightness(1.8); }
+  60% { transform: scale(1.1); filter: brightness(1.15); }
+  100% { transform: scale(1); filter: none; }
+}
+
+/* 몬스터를 쓰러뜨린 순간: 한 번 펄쩍(0.6초) */
+.avatar-victory > svg {
+  animation: avatar-victory 0.6s ease-out both;
+}
+
+@keyframes avatar-victory {
+  0% { transform: translateY(0); }
+  35% { transform: translateY(-16px); }
+  60% { transform: translateY(0); }
+  78% { transform: translateY(-5px); }
+  100% { transform: translateY(0); }
+}
+
 @keyframes avatar-energetic {
   0%, 100% { transform: translateY(0) scale(1); }
   50% { transform: translateY(-2px) scale(1.01); }
diff --git a/frontend/src/components/boss/BossFight.tsx b/frontend/src/components/boss/BossFight.tsx
index a8fe97e..1d60eb2 100644
--- a/frontend/src/components/boss/BossFight.tsx
+++ b/frontend/src/components/boss/BossFight.tsx
@@ -260,6 +260,7 @@ export default function BossFight({ hit, character, mbti, motion, replayKey = 0,
                 size={104}
                 action={myAction}
                 pumped={done}
+                celebrate={done && killed}
               />
             ) : (
               <span className="pb-6 text-xs text-steel-500">캐릭터 불러오는 중</span>
diff --git a/frontend/src/components/boss/DungeonStage.tsx b/frontend/src/components/boss/DungeonStage.tsx
index 2aa06bc..55205cc 100644
--- a/frontend/src/components/boss/DungeonStage.tsx
+++ b/frontend/src/components/boss/DungeonStage.tsx
@@ -272,6 +272,7 @@ export default function DungeonStage({ character, mbti, hp, remaining, hit, play
                   size={100}
                   action={myAction}
                   pumped={down}
+                  celebrate={down && myAction?.kind === "flex"}
                 />
               ) : (
                 <span className="pb-6 text-xs text-steel-500">캐릭터 불러오는 중</span>
diff --git a/frontend/src/components/dungeon/dungeonWorld.ts b/frontend/src/components/dungeon/dungeonWorld.ts
index a481d1e..e4c25f6 100644
--- a/frontend/src/components/dungeon/dungeonWorld.ts
+++ b/frontend/src/components/dungeon/dungeonWorld.ts
@@ -5,7 +5,7 @@
 // 이동: 조이스틱 · 방향키 · WASD 는 누르는 동안 계속(84px/초), 바닥 탭은 길찾기, 몬스터 탭은 그 옆까지 걸어감.
 // 몬스터는 2~4칸을 천천히 왕복할 뿐 쫓아오지 않는다. 닿으면 onEncounter(한 번), 멀어지면(28px) 다시 닿을 수 있다.
 // React 는 HUD · 조이스틱 · 전투 창을 맡고, 이 파일은 그림 · 걷기 · 순찰 · 닿음만 맡는다. 전투 중(paused)엔 멈춘다.
-import { drawChar, palOf, toneForMbti, type Pal, type SpriteShape } from "../gymMap/engine";
+import { drawChar, palOf, toneForMbti, walkPose, type Pal, type SpriteShape } from "../gymMap/engine";
 import { artSize, drawMob } from "./mobArt";
 
 export const TILE = 16;
@@ -480,8 +480,8 @@ export function createDungeon(canvas: HTMLCanvasElement, me: { mbti?: string | n
         g.ellipse(player.x, player.y + 1, 5, 2, 0, 0, Math.PI * 2);
         g.fill();
         const moving = player.path.length > 0 || Math.hypot(input().x, input().y) > 0.15;
-        const frame = moving && !paused ? 1 + (Math.floor(player.step * 8) % 2) : 0;
-        drawChar(g, Math.round(player.x - 5), Math.round(player.y - 16), myPal, { frame, back: player.back });
+        const pose = walkPose(player.step * 8, moving && !paused, now);
+        drawChar(g, Math.round(player.x - 5), Math.round(player.y - 16), myPal, { frame: pose.frame, back: player.back, hop: pose.hop, squash: pose.squash });
       },
     });
     list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
diff --git a/frontend/src/components/gymMap/engine.ts b/frontend/src/components/gymMap/engine.ts
index 5ceb6f9..2f91c6a 100644
--- a/frontend/src/components/gymMap/engine.ts
+++ b/frontend/src/components/gymMap/engine.ts
@@ -538,7 +538,25 @@ const LEGS = [
   ["..bb..bb..", "..ss..ss..", "..ww..ss..", "......ww.."],
   ["..bb..bb..", "..ss..ss..", "..ss..ww..", "..ww......"],
 ];
-export type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean };
+/**
+ * frame 다리(0 서기 · 1 · 2 걷기) · sit 앉기 · back 뒷모습 · over 머리 위 바
+ * hop 몸 전체를 위로(통통 걷기) · squash 머리를 한 칸 내려 어깨에 묻는다(착지 · 숨 내쉬기)
+ */
+export type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean; hop?: number; squash?: boolean };
+
+/**
+ * 작은 그림의 움직임(2026-10-20) — 치비답게 통통.
+ * 걷기: cycle(걸음 수 같은 연속 값)을 4박자로 나눠 다리 1 · 1 · 2 · 2, 박자마다 뜸(hop 1) → 착지(머리가 한 박자 늦게 내려앉음).
+ * 서기: 1.6초마다 0.35초 머리가 한 칸 내려앉는 숨쉬기. seed 로 사람마다 박자를 어긋나게.
+ */
+export function walkPose(cycle: number, moving: boolean, now: number, seed = 0): { frame: number; hop: number; squash: boolean } {
+  if (moving) {
+    const phase = Math.floor(cycle * 2) % 4;
+    return { frame: phase < 2 ? 1 : 2, hop: phase % 2 === 0 ? 1 : 0, squash: phase % 2 === 1 };
+  }
+  const t = (now / 1000 + seed * 0.37) % 1.6;
+  return { frame: 0, hop: 0, squash: t > 1.25 };
+}
 
 /** 그릴 칸 목록 [x, y, 글자](x · y 는 왼쪽 위 기준, 위로 솟는 머리는 y < 0) */
 function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, number, string][] {
@@ -555,9 +573,12 @@ function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, nu
   }
   if (sh?.band) head[2] = "dddddddddd";
   const rows: [number, number, string][] = head.map((row, i) => [i, 0, row]);
-  if (female && hair % 2 === 1) rows.push([-3, 0, "....hh...."], [-2, 0, "...hhhh..."], [-1, 0, "....hh...."]); // 똥머리(둥근 공 + 묶은 자리)
-  else if (!female && hair === 1) rows.push([-1, 0, ".h..h.h.h."]); // 삐죽 머리
-  else if (!female && hair === 2) rows.push([-1, 0, "..hhhhh..."]); // 높은 앞머리
+  const headRows: [number, number, string][] = [];
+  if (female && hair % 2 === 1) headRows.push([-3, 0, "....hh...."], [-2, 0, "...hhhh..."], [-1, 0, "....hh...."]); // 똥머리(둥근 공 + 묶은 자리)
+  else if (!female && hair === 1) headRows.push([-1, 0, ".h..h.h.h."]); // 삐죽 머리
+  else if (!female && hair === 2) headRows.push([-1, 0, "..hhhhh..."]); // 높은 앞머리
+  rows.push(...headRows);
+  if (o.squash) rows.forEach((r) => (r[0] += 1));
   const body = stage <= 0 ? BODY.thin : stage <= 1 ? BODY.base : stage <= 3 ? BODY.broad : BODY.huge;
   body.forEach(([dx, row], i) => rows.push([8 + i, dx, row]));
   if (!o.sit) LEGS[o.frame ?? 0].forEach((row, i) => rows.push([12 + i, 0, row]));
@@ -576,7 +597,8 @@ function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, nu
 }
 
 /** 10×16 픽셀 치비(홈 지도 · 라운지 광장 · 던전이 같은 그림) */
-export function drawChar(g: CanvasRenderingContext2D, x: number, y: number, pal: Pal, o: CharOpts = {}) {
+export function drawChar(g: CanvasRenderingContext2D, x: number, y0: number, pal: Pal, o: CharOpts = {}) {
+  const y = y0 - (o.hop ?? 0);
   const cells = charCells(o, pal.shape);
   g.fillStyle = C.ink;
   for (const [cx, cy] of cells) {
@@ -817,14 +839,15 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
     }
   };
 
-  const drawNpc = (n: Npc) => {
+  const drawNpc = (n: Npc, now: number, seed: number) => {
     const px = Math.round(n.w.x * TILE + 3);
     const py = Math.round(n.w.y * TILE) - 1;
-    const frame = n.w.moving ? 1 + (Math.floor(n.w.anim * 7) % 2) : 0;
+    const pose = walkPose(n.w.anim * 7, n.w.moving, now, seed);
+    const frame = pose.frame;
     g.globalAlpha = 0.35;
     fill(g, px, py + 15, 10, 2, "#000");
     g.globalAlpha = 1;
-    drawChar(g, px, py, npcPal(n.id, look), { frame, back: n.w.back });
+    drawChar(g, px, py, npcPal(n.id, look), { frame, back: n.w.back, hop: pose.hop, squash: pose.squash });
     if (n.id === "staff") {
       // 걸레: 자루 + 걸레 머리(걸을 때 좌우로 흔들림)
       const sway = n.w.moving ? (frame === 1 ? -1 : 1) : 0;
@@ -960,14 +983,14 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
     const px = Math.round(player.x * TILE + 3);
     const py = Math.round(player.y * TILE) - 1;
     const over = now < overUntil;
-    const walkFrame = player.moving ? 1 + (Math.floor(player.anim * 12) % 2) : 0;
+    const walk = walkPose(player.anim * 12, player.moving && !over, now);
     const sitters = main ? Math.min(3, Math.max(0, state.loungeCount)) : 0;
     const actors: { y: number; draw: () => void }[] = [];
     for (let i = 0; i < sitters; i++) {
       const [sx, sy] = SEATS[i];
-      actors.push({ y: sy + 16, draw: () => drawChar(g, sx, sy, GUESTS[i], { sit: true }) });
+      actors.push({ y: sy + 16, draw: () => drawChar(g, sx, sy, GUESTS[i], { sit: true, squash: walkPose(0, false, now, i + 3).squash }) });
     }
-    for (const n of npcs) actors.push({ y: n.w.y * TILE + 15, draw: () => drawNpc(n) });
+    npcs.forEach((n, i) => actors.push({ y: n.w.y * TILE + 15, draw: () => drawNpc(n, now, i + 1) }));
     actors.push({
       y: py + 16.5,
       draw: () => {
@@ -975,7 +998,7 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
         fill(g, px - 1, py + 15, 12, 2, C.yellow);
         fill(g, px + 1, py + 17, 8, 1, C.yellow);
         g.globalAlpha = 1;
-        drawChar(g, px, py - (walkFrame === 1 ? 1 : 0), pal, { frame: over ? 0 : walkFrame, back: !over && player.back, over });
+        drawChar(g, px, py, pal, { frame: over ? 0 : walk.frame, back: !over && player.back, over, hop: walk.hop, squash: !over && walk.squash });
       },
     });
     actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
diff --git a/frontend/src/components/lounge/plaza.ts b/frontend/src/components/lounge/plaza.ts
index 86c1df3..a310d24 100644
--- a/frontend/src/components/lounge/plaza.ts
+++ b/frontend/src/components/lounge/plaza.ts
@@ -5,7 +5,7 @@
 // 아래: 잔디 · 나무 · 남쪽 입구(처음 서는 곳).
 // 사람 그림은 홈 지도와 같은 10×16 리프터(drawChar). 이름표 · 말풍선 · 이모트는 캔버스에 같이 그린다.
 // 위치는 월드 픽셀(발 가운데)로 주고받는다 — 실시간 서버는 x · y 를 받아 범위만 자르고 그대로 전한다.
-import { drawChar, palOf, toneForMbti, type Pal, type SpriteShape } from "../gymMap/engine";
+import { drawChar, palOf, toneForMbti, walkPose, type Pal, type SpriteShape } from "../gymMap/engine";
 
 export const TILE = 16;
 export const COLS = 28;
@@ -714,8 +714,10 @@ export function createPlaza(canvas: HTMLCanvasElement, me: Omit<PlazaPlayer, "x"
       g.ellipse(a.x, a.y + 1, 5, 2, 0, 0, Math.PI * 2);
       g.fill();
       const moving = a === mine ? mine.path.length > 0 : Math.hypot(a.tx - a.x, a.ty - a.y) > 0.5;
-      const frame = moving ? 1 + (Math.floor(a.step * 8) % 2) : 0;
-      drawChar(g, Math.round(a.x - 5), Math.round(a.y - 16), a.pal, { frame });
+      // 사람마다 숨쉬기 박자를 어긋나게(아이디 글자로)
+      const seed = a.id.length ? a.id.charCodeAt(a.id.length - 1) : 0;
+      const pose = walkPose(a.step * 8, moving, now, seed);
+      drawChar(g, Math.round(a.x - 5), Math.round(a.y - 16), a.pal, { frame: pose.frame, hop: pose.hop, squash: pose.squash });
     }
     for (const a of actors) {
       const isMe = a === mine;
diff --git a/frontend/src/pages/Home.tsx b/frontend/src/pages/Home.tsx
index f3a7d57..21ee5f5 100644
--- a/frontend/src/pages/Home.tsx
+++ b/frontend/src/pages/Home.tsx
@@ -1,7 +1,8 @@
 ﻿import { useCallback, useEffect, useMemo, useState } from "react";
 import { Link } from "react-router-dom";
 import AvatarRenderer from "../components/avatar/AvatarRenderer";
-import { spriteShapeOf } from "../components/avatar/spriteShape";
+import { bodyStageFor, spriteShapeOf } from "../components/avatar/spriteShape";
+import BodyStageUp from "../components/avatar/BodyStageUp";
 import { toneForMbti } from "../components/gymMap/engine";
 import CountUp from "../components/gym/CountUp";
 import GymMap from "../components/gymMap/GymMap";
@@ -493,6 +494,27 @@ export default function Home() {
           </div>
 
           <div className="hero-map dg-rubber">
+            {character && (
+              // 몸 단계가 지난번 본 값보다 오르면 "몸이 커졌어요"(펌핑은 빼고)
+              <BodyStageUp
+                key={character.avatarSeed}
+                seedKey={character.avatarSeed}
+                stage={bodyStageFor({ ...character, pumped: false })}
+                renderAvatar={(b, size) => (
+                  <AvatarRenderer
+                    avatarSeed={character.avatarSeed}
+                    growthParams={character.growthParams}
+                    bodyStage={b}
+                    tier={character.tier}
+                    stage={character.evolutionStage}
+                    gender={character.gender}
+                    mbti={mbti}
+                    tank={character.tank}
+                    size={size}
+                  />
+                )}
+              />
+            )}
             <GymMap
               loggedIn={Boolean(user)}
               level={character?.level}
```
