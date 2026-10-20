# 2026-10-20 · 라운지 이모트 동작 · 홈 지도 기구 운동 · 카드 누르면 반응 — 코드 단위 기록

요약은 [fix-log](../fix-log.md) 같은 날 항목. 앞 단계: [움직임](2026-10-20-chibi-motion-life.md).

## 작은 그림 자세 `drawChar({ pose, poseFrame })`

| 자세 | 어디서 | 장면 0 → 1 |
| --- | --- | --- |
| wave 인사 | 라운지 이모트 | 오른손을 머리 옆으로 → 바깥으로 한 칸(흔들기) |
| cheer 화이팅 | 라운지 이모트 | 두 주먹 머리 옆 → 머리 위(장면 1 에 한 칸 뜀) |
| clap 박수 | 라운지 이모트 | 팔을 벌림 → 가슴 앞에서 손을 모음 |
| gg 꾸벅 | 라운지 이모트 | 그대로 → 머리를 두 칸 숙임(팔은 그대로) |
| squat 스쿼트 | 홈 지도 파워랙 | 목 뒤 바벨, 서 있음 → 몸 두 칸 내려가고 다리 접힘(0.65초씩) |
| flex 알통 | 홈 지도 거울 | 더블 바이셉스, 장면 1 에 알통이 한 칸 더(0.75초씩) |

- 팔: 자세가 있으면 몸통 줄의 몸통 밖 피부 칸(x < 2 · x > 7, 인사는 오른쪽만)을 지우고 `poseArms()` 의 왼팔 칸을 그린다. 오른팔은 `9 - x` 로 거울.
- 러닝머신은 자세 대신 `walkPose(now / 90, true)` 로 제자리 달리기(앞을 본다).
- 라운지: `say(id, text, "emote", kind)` → `Actor.emote = { kind, until: +2.5초 }`. 서 있을 때만 자세, 장면은 0.22초씩.
- 라운지 다시 그리기: 바쁜 조건에 `now - lastDraw > 100` 을 더해 서 있어도 숨쉬기가 보인다.

## 카드 누르면 반응 `TapAvatar`

- `AvatarRenderer` 를 감싼 버튼. 누를 때마다 다음 반응(1.4초): 알통(`action: flex 1` + `celebrate`) → 윙크(`expression: "wink"`) → 펄쩍(`expression: "smile"` + `celebrate`). `key` 를 바꿔 매번 처음부터.
- 쉬는 중이면 몸은 그대로, "쉬는 중이에요"만.
- `AvatarRenderer.expression`(치비 표정 직접 고르기)과 `chibiArt` 새 표정 `wink`(오른눈 ^ · 웃는 입).

## diff

```diff
diff --git a/frontend/src/components/avatar/AvatarRenderer.tsx b/frontend/src/components/avatar/AvatarRenderer.tsx
index 39345ad..e4523a0 100644
--- a/frontend/src/components/avatar/AvatarRenderer.tsx
+++ b/frontend/src/components/avatar/AvatarRenderer.tsx
@@ -38,6 +38,8 @@ type Props = {
   bodyStage?: number | null;
   /** 이긴 순간(몬스터를 쓰러뜨림): 반짝이는 눈 + 한 번 펄쩍 */
   celebrate?: boolean;
+  /** 치비 표정을 직접 고른다(누르면 반응 — 윙크 등). 없으면 상태로 정한다 */
+  expression?: ChibiExpression | null;
 };
 
 // 피부·머리 색은 MBTI 를 따르고, 민소매 색은 원판 팔레트에서 고른다.
@@ -88,6 +90,7 @@ export default function AvatarRenderer({
   pumped = false,
   bodyStage = null,
   celebrate = false,
+  expression: expressionOverride = null,
 }: Props) {
   const [persistedAppearance, setPersistedAppearance] = useState(() => loadAppearanceBySeed(avatarSeed));
 
@@ -158,7 +161,7 @@ export default function AvatarRenderer({
         : bodyStageOf({ muscularity: growth.muscularityNormalized, level: Math.max(1, stage) * 10 + 1, activityLevel: 0 });
       const chibiStage = Math.min(5, base + (pumpedNow ? 1 : 0)) as ChibiSpec["bodyStage"];
       const chibiPose = resolvedResting ? "stand" : pose === "stand" ? "stand" : "flex";
-      const expression: ChibiExpression = chibiAct
+      const expression: ChibiExpression = expressionOverride ?? (chibiAct
         ? chibiAct.frame === 1
           ? chibiAct.kind === "flex"
             ? celebrate
@@ -172,7 +175,7 @@ export default function AvatarRenderer({
             ? "smile"
             : chibiPose === "flex" || tierStep >= 5
               ? "smile"
-              : "normal";
+              : "normal");
       return buildChibi({
         variant: "B",
         bodyStage: chibiStage,
@@ -235,6 +238,7 @@ export default function AvatarRenderer({
     pumped,
     bodyStage,
     celebrate,
+    expressionOverride,
   ]);
 
   const y = (row: number) => row * CELL;
diff --git a/frontend/src/components/avatar/chibiArt.ts b/frontend/src/components/avatar/chibiArt.ts
index 82a7ce8..992b534 100644
--- a/frontend/src/components/avatar/chibiArt.ts
+++ b/frontend/src/components/avatar/chibiArt.ts
@@ -12,7 +12,7 @@ import { BAR, Grid, INK, IRON, shade } from "./pixelGrid";
 import { drawBar, type ActionKind, type Equip, type PixelAction, type PixelAvatarArt, type PixelEffect } from "./pixelAvatar";
 
 export type ChibiVariant = "A" | "B" | "C";
-export type ChibiExpression = "normal" | "smile" | "strain" | "tired" | "sparkle";
+export type ChibiExpression = "normal" | "smile" | "strain" | "tired" | "sparkle" | "wink";
 export type ChibiPose = "stand" | "flex";
 
 export type ChibiSpec = {
@@ -511,6 +511,14 @@ export function buildChibi(spec: ChibiSpec): PixelAvatarArt {
   const eyeInk = spec.eyeColor ?? INK;
   const eye = (x: number) => {
     const left = x < 12;
+    if (ex === "wink" && !left) {
+      // 윙크: 오른쪽 눈만 ^ 로 감는다
+      const row = eyeRow + Math.floor(v.eyeH / 2);
+      g.set(x - 1, row, eyeInk);
+      g.set(x, row - 1, eyeInk);
+      g.set(x + 1, row, eyeInk);
+      return;
+    }
     if (ex === "strain") {
       // > < 꾹 감은 눈
       const mid = eyeRow + Math.floor(v.eyeH / 2);
@@ -559,7 +567,7 @@ export function buildChibi(spec: ChibiSpec): PixelAvatarArt {
   }
   // 입(턱 두 줄 위)
   const my = headBottom - 2;
-  if (ex === "smile" || ex === "sparkle") {
+  if (ex === "smile" || ex === "sparkle" || ex === "wink") {
     g.set(10, my - 1, INK);
     g.rect(11, 12, my, my, MOUTH);
     g.set(13, my - 1, INK);
diff --git a/frontend/src/components/gymMap/engine.ts b/frontend/src/components/gymMap/engine.ts
index 2f91c6a..2dbab3d 100644
--- a/frontend/src/components/gymMap/engine.ts
+++ b/frontend/src/components/gymMap/engine.ts
@@ -541,8 +541,45 @@ const LEGS = [
 /**
  * frame 다리(0 서기 · 1 · 2 걷기) · sit 앉기 · back 뒷모습 · over 머리 위 바
  * hop 몸 전체를 위로(통통 걷기) · squash 머리를 한 칸 내려 어깨에 묻는다(착지 · 숨 내쉬기)
+ * pose 자세(팔을 따로 그린다) · poseFrame 자세의 두 장면(0 · 1 번갈아)
  */
-export type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean; hop?: number; squash?: boolean };
+export type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean; hop?: number; squash?: boolean; pose?: SpritePose | null; poseFrame?: number };
+
+/**
+ * 작은 그림 자세(2026-10-20)
+ *  라운지 이모트: wave 인사(오른손 흔들기) · cheer 화이팅(두 주먹 위로) · clap 박수(두 손 모으기) · gg 꾸벅(고개 숙이기)
+ *  홈 지도 기구: squat 파워랙(바를 메고 앉았다 일어나기) · flex 거울(알통 자세, 알통이 부풀었다 줄었다)
+ */
+export type SpritePose = "wave" | "cheer" | "clap" | "gg" | "squat" | "flex";
+
+/** 자세별 왼팔 칸 [x, y](오른팔은 9 - x 로 거울). wave 는 오른팔만 */
+function poseArms(pose: SpritePose, f: number): [number, number][] {
+  const left = (cells: [number, number][]) => [...cells, ...cells.map(([x, y]) => [9 - x, y] as [number, number])];
+  switch (pose) {
+    case "wave":
+      // 오른손을 머리 옆으로 들어 좌우로 흔든다
+      return [[9, 8], [9, 7], [10, 6], [10, 5], [10, 4], [10, 3], ...(f ? ([[11, 2], [11, 1]] as [number, number][]) : ([[10, 2], [10, 1]] as [number, number][]))];
+    case "cheer": {
+      // 두 주먹을 머리 옆 → 머리 위로
+      const top = f ? 0 : 3;
+      const arm: [number, number][] = [[0, 8]];
+      for (let yy = 7; yy > top; yy -= 1) arm.push([-1, yy]);
+      return left([...arm, [-1, top], [-1, top - 1]]);
+    }
+    case "clap":
+      // 벌렸다 → 가슴 앞에서 손을 모은다
+      return left(f ? [[1, 8], [2, 9], [3, 9], [4, 9]] : [[1, 8], [1, 9], [1, 10], [2, 10]]);
+    case "flex":
+      // 더블 바이셉스: 위팔은 옆으로, 팔뚝은 위로, 주먹은 머리 옆. 장면 1 은 알통이 한 칸 더 솟는다
+      return left([[0, 8], [-1, 8], [-2, 8], [-2, 7], [-2, 6], [-2, 5], [-3, 4], [-2, 4], [-1, 7], ...(f ? ([[-1, 6]] as [number, number][]) : [])]);
+    case "squat":
+      // 목 뒤 바를 두 손으로 쥔다
+      return left([[0, 8], [-1, 8], [-1, 7], [-1, 6]]);
+    default:
+      return [];
+  }
+}
+const SQUAT_LEGS = [".sb....bs.", "ww......ww"];
 
 /**
  * 작은 그림의 움직임(2026-10-20) — 치비답게 통통.
@@ -578,10 +615,21 @@ function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, nu
   else if (!female && hair === 1) headRows.push([-1, 0, ".h..h.h.h."]); // 삐죽 머리
   else if (!female && hair === 2) headRows.push([-1, 0, "..hhhhh..."]); // 높은 앞머리
   rows.push(...headRows);
-  if (o.squash) rows.forEach((r) => (r[0] += 1));
+  const pose = o.pose ?? null;
+  const f = o.poseFrame ?? 0;
+  // 꾸벅(gg 장면 1)은 머리를 두 칸, 착지 · 숨쉬기는 한 칸 내려앉힌다
+  const sink = pose === "gg" && f === 1 ? 2 : o.squash ? 1 : 0;
+  if (sink) rows.forEach((r) => (r[0] += sink));
   const body = stage <= 0 ? BODY.thin : stage <= 1 ? BODY.base : stage <= 3 ? BODY.broad : BODY.huge;
-  body.forEach(([dx, row], i) => rows.push([8 + i, dx, row]));
-  if (!o.sit) LEGS[o.frame ?? 0].forEach((row, i) => rows.push([12 + i, 0, row]));
+  // 자세가 있으면 옆 팔(몸통 밖 피부 칸)을 지우고 아래에서 자세 팔을 따로 그린다(꾸벅은 팔 그대로, 인사는 오른팔만)
+  const clearArm = (dx: number, row: string) =>
+    !pose || pose === "gg"
+      ? row
+      : [...row].map((ch, i) => (ch === "s" && ((pose !== "wave" && dx + i < 2) || dx + i > 7) ? "." : ch)).join("");
+  body.forEach(([dx, row], i) => rows.push([8 + i, dx, clearArm(dx, row)]));
+  const squatDown = pose === "squat" && f === 1;
+  if (squatDown) rows.forEach((r) => (r[0] += 2)); // 앉으면 몸이 두 칸 내려가고 다리는 접힌다
+  if (!o.sit) (squatDown ? SQUAT_LEGS : LEGS[o.frame ?? 0]).forEach((row, i) => rows.push([(squatDown ? 14 : 12) + i, 0, row]));
   const cells: [number, number, string][] = [];
   for (const [dy, dx, row] of rows) {
     for (let i = 0; i < row.length; i += 1) {
@@ -593,6 +641,7 @@ function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, nu
       cells.push([cx, dy, ch]);
     }
   }
+  if (pose) for (const [ax, ay] of poseArms(pose, f)) cells.push([ax, ay + (squatDown ? 2 : 0), "s"]);
   return cells;
 }
 
@@ -600,6 +649,16 @@ function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, nu
 export function drawChar(g: CanvasRenderingContext2D, x: number, y0: number, pal: Pal, o: CharOpts = {}) {
   const y = y0 - (o.hop ?? 0);
   const cells = charCells(o, pal.shape);
+  if (o.pose === "squat") {
+    // 목 뒤 바벨(머리가 앞을 가린다): 봉 · 빨간 원판
+    const by = y + 7 + ((o.poseFrame ?? 0) === 1 ? 2 : 0);
+    fill(g, x - 7, by - 1, 24, 3, C.ink);
+    fill(g, x - 7, by - 4, 4, 9, C.ink);
+    fill(g, x + 13, by - 4, 4, 9, C.ink);
+    fill(g, x - 6, by, 22, 1, "#B9BCC3");
+    fill(g, x - 6, by - 3, 2, 7, C.red);
+    fill(g, x + 14, by - 3, 2, 7, C.red);
+  }
   g.fillStyle = C.ink;
   for (const [cx, cy] of cells) {
     g.fillRect(x + cx - 1, y + cy, 3, 1);
@@ -983,7 +1042,11 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
     const px = Math.round(player.x * TILE + 3);
     const py = Math.round(player.y * TILE) - 1;
     const over = now < overUntil;
-    const walk = walkPose(player.anim * 12, player.moving && !over, now);
+    // 기구 앞에 멈춰 서면 운동: 파워랙 스쿼트 · 거울 알통 · 러닝머신 제자리 달리기(1층에서만)
+    const gear = main && !player.moving && !over && (zone === "rack" || zone === "mirror" || zone === "crew") ? zone : null;
+    const walk = gear === "crew" ? walkPose(now / 90, true, now) : walkPose(player.anim * 12, player.moving && !over, now);
+    const gearPose: SpritePose | null = gear === "rack" ? "squat" : gear === "mirror" ? "flex" : null;
+    const gearFrame = Math.floor(now / (gear === "rack" ? 650 : 750)) % 2;
     const sitters = main ? Math.min(3, Math.max(0, state.loungeCount)) : 0;
     const actors: { y: number; draw: () => void }[] = [];
     for (let i = 0; i < sitters; i++) {
@@ -998,7 +1061,15 @@ export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: M
         fill(g, px - 1, py + 15, 12, 2, C.yellow);
         fill(g, px + 1, py + 17, 8, 1, C.yellow);
         g.globalAlpha = 1;
-        drawChar(g, px, py, pal, { frame: over ? 0 : walk.frame, back: !over && player.back, over, hop: walk.hop, squash: !over && walk.squash });
+        drawChar(g, px, py, pal, {
+          frame: over ? 0 : walk.frame,
+          back: !over && !gear && player.back,
+          over,
+          hop: gearPose ? 0 : walk.hop,
+          squash: !over && !gearPose && walk.squash,
+          pose: gearPose,
+          poseFrame: gearFrame,
+        });
       },
     });
     actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
diff --git a/frontend/src/components/lounge/PlazaView.tsx b/frontend/src/components/lounge/PlazaView.tsx
index 644cb71..dd98fca 100644
--- a/frontend/src/components/lounge/PlazaView.tsx
+++ b/frontend/src/components/lounge/PlazaView.tsx
@@ -92,7 +92,7 @@ export default function PlazaView(p: Props) {
     for (const e of p.emotes) {
       if (shownEmote.current.has(e.id)) continue;
       shownEmote.current.add(e.id);
-      ctl.current?.say(e.playerId, EMOTES.find((x) => x.kind === e.kind)?.say ?? "!", "emote");
+      ctl.current?.say(e.playerId, EMOTES.find((x) => x.kind === e.kind)?.say ?? "!", "emote", e.kind);
     }
   }, [p.emotes]);
 
diff --git a/frontend/src/components/lounge/plaza.ts b/frontend/src/components/lounge/plaza.ts
index a310d24..dc875fd 100644
--- a/frontend/src/components/lounge/plaza.ts
+++ b/frontend/src/components/lounge/plaza.ts
@@ -457,6 +457,8 @@ type Actor = PlazaPlayer & {
   frame: number;
   step: number;
   bubble: { text: string; until: number; tone: "chat" | "emote" } | null;
+  /** 이모트 동작(말풍선과 같이 2.5초) */
+  emote?: { kind: EmoteKind; until: number } | null;
 };
 
 export type PlazaCallbacks = {
@@ -468,7 +470,8 @@ export type PlazaCallbacks = {
 
 export type PlazaController = {
   setPlayers: (list: PlazaPlayer[]) => void;
-  say: (id: string, text: string, tone?: "chat" | "emote") => void;
+  /** 말풍선. 이모트면 kind 로 몸 동작도 한다(인사 · 화이팅 · 박수 · 꾸벅) */
+  say: (id: string, text: string, tone?: "chat" | "emote", kind?: EmoteKind) => void;
   walkToZone: (zone: PlazaZone) => void;
   destroy: () => void;
 };
@@ -505,6 +508,7 @@ export function createPlaza(canvas: HTMLCanvasElement, me: Omit<PlazaPlayer, "x"
   let zone: PlazaZone | null = null;
   let lastSent = 0;
   let dirty = true;
+  let lastDraw = 0;
   let raf = 0;
   let last = performance.now();
   let scale = 1;
@@ -717,7 +721,15 @@ export function createPlaza(canvas: HTMLCanvasElement, me: Omit<PlazaPlayer, "x"
       // 사람마다 숨쉬기 박자를 어긋나게(아이디 글자로)
       const seed = a.id.length ? a.id.charCodeAt(a.id.length - 1) : 0;
       const pose = walkPose(a.step * 8, moving, now, seed);
-      drawChar(g, Math.round(a.x - 5), Math.round(a.y - 16), a.pal, { frame: pose.frame, hop: pose.hop, squash: pose.squash });
+      // 이모트 중(서 있을 때): 몸 동작 두 장면을 번갈아
+      const emote = !moving && a.emote && now < a.emote.until ? a.emote.kind : null;
+      drawChar(g, Math.round(a.x - 5), Math.round(a.y - 16), a.pal, {
+        frame: pose.frame,
+        hop: emote ? (emote === "cheer" && Math.floor(now / 220) % 2 === 1 ? 1 : 0) : pose.hop,
+        squash: !emote && pose.squash,
+        pose: emote,
+        poseFrame: Math.floor(now / 220) % 2,
+      });
     }
     for (const a of actors) {
       const isMe = a === mine;
@@ -743,9 +755,12 @@ export function createPlaza(canvas: HTMLCanvasElement, me: Omit<PlazaPlayer, "x"
       dirty = true;
       cb.onZone(zone);
     }
-    // 움직임 · 말풍선 · 누른 자리 표시가 있을 때만 다시 그린다
-    const busy = moved || dirty || [...others.values(), mine].some((a) => a.bubble) || (tapMark && now - tapMark.t < 600);
-    if (busy) render(now);
+    // 움직임 · 말풍선 · 누른 자리 표시가 있으면 매 장면, 없어도 숨쉬기가 보이게 0.1초마다 한 번 다시 그린다
+    const busy = moved || dirty || [...others.values(), mine].some((a) => a.bubble) || (tapMark && now - tapMark.t < 600) || now - lastDraw > 100;
+    if (busy) {
+      render(now);
+      lastDraw = now;
+    }
     dirty = false;
     raf = requestAnimationFrame(loop);
   };
@@ -775,10 +790,11 @@ export function createPlaza(canvas: HTMLCanvasElement, me: Omit<PlazaPlayer, "x"
       for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
       dirty = true;
     },
-    say(id, text, tone = "chat") {
+    say(id, text, tone = "chat", kind) {
       const a = id === me.id ? mine : others.get(id);
       if (!a) return;
       a.bubble = { text, until: performance.now() + (tone === "emote" ? 2500 : 4500), tone };
+      if (kind) a.emote = { kind, until: performance.now() + 2500 };
       dirty = true;
     },
     walkToZone(z) {
diff --git a/frontend/src/pages/Home.tsx b/frontend/src/pages/Home.tsx
index 21ee5f5..5e393fb 100644
--- a/frontend/src/pages/Home.tsx
+++ b/frontend/src/pages/Home.tsx
@@ -3,6 +3,7 @@ import { Link } from "react-router-dom";
 import AvatarRenderer from "../components/avatar/AvatarRenderer";
 import { bodyStageFor, spriteShapeOf } from "../components/avatar/spriteShape";
 import BodyStageUp from "../components/avatar/BodyStageUp";
+import TapAvatar from "../components/avatar/TapAvatar";
 import { toneForMbti } from "../components/gymMap/engine";
 import CountUp from "../components/gym/CountUp";
 import GymMap from "../components/gymMap/GymMap";
@@ -418,7 +419,8 @@ export default function Home() {
       <div className="character-stage dg-rubber">
         {character ? (
           <div className={`avatar-shell ${showReaction ? "reacted" : ""}`}>
-            <AvatarRenderer
+            {/* 누르면 알통 자랑 → 윙크 → 펄쩍 */}
+            <TapAvatar
               avatarSeed={character.avatarSeed}
               growthParams={character.growthParams}
               bodyStage={character.bodyStage}
```
