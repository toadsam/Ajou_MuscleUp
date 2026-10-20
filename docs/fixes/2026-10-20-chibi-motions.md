# 2026-10-20 · 운동 동작 · 작은 지도 그림 치비화 — 코드 단위 기록

요약은 [fix-log](../fix-log.md) 같은 날 항목. 설계: [character-chibi.md](../design/character-chibi.md) 4절 3 · 4.

## 무엇을 어디서

| 그림 | 파일 | 바뀐 것 |
| --- | --- | --- |
| 정면 동작 9가지 | `frontend/src/components/avatar/chibiArt.ts` | `ChibiSpec.action`, `CHIBI_FRONT_KINDS`, `armModeOf`, 동작 팔(`drawActionArms` · `limb`), 앉은 · 든 다리, 몸 뒤 · 앞 기구 |
| 연결 | `frontend/src/components/avatar/AvatarRenderer.tsx` | 정면 동작이면 치비로(`chibiAct`), 힘주는 프레임 = `strain`, 알통 = `smile` |
| 옆모습 16가지 | `frontend/src/components/avatar/pixelPoses.ts` | `drawSideHead`(9×9 치비 머리), `buildPoseArt` 머리 교체 |
| 벤치 · 푸시업 | `frontend/src/components/avatar/pixelAvatar.ts` | 같은 `drawSideHead`, `drawBar` 내보내기(치비 바벨이 같이 씀) |
| 작은 그림 | `frontend/src/components/gymMap/engine.ts` | `drawChar` 10×16 치비, `Pal.p`(볼) · `BLUSH` |

## 정면 동작 규칙(chibiArt)

- 팔 모양(프레임 0 → 1): 스쿼트 rack(바벨) / stand · 데드 stand · 프레스 rackLow → overhead · 컬 stand → curl · 레이즈 stand → wide · 플라이 wide → front · 턱걸이 · 다리 들기 hang · 알통 stand → flex.
- 몸 이동 `drop`(행): 스쿼트 +3, 데드 +2, 턱걸이 -5. 바에 붙은 손(rack · overhead · hang)은 절대 좌표라 몸이 움직여도 그대로.
- 치비는 머리 폭(14칸)이 어깨보다 넓다 → 머리 위 · 목 뒤 팔은 어깨 → 머리 바깥 팔꿈치 → 주먹 두 토막(`limb`, 굵기 = 팔 두께). 머리 뒤를 지나는 팔 부분은 머리가 덮는다.
- 기구 순서: 철봉 · 목 뒤 바벨 · 머리 위 바벨은 맨 먼저(머리가 앞), 데드 · 프레스 시작 · 컬 바벨과 덤벨은 얼굴 다음(몸 앞) — 주먹을 다시 칠해 봉을 쥐게.
- 앉은 다리: 무릎이 반바지 옆으로 두 칸 벌어지고 발이 넓게, 반바지 아래가 한 칸 넓어진다. 든 다리: 바닥의 다리를 지우고 신발 바닥을 반바지 앞에.
- 티어 장비: 손목 보호대는 주먹 옆 한 줄, 무릎 보호대 · 금 신발은 앉은 · 든 다리에선 다리 그릴 때 색으로.

## 옆모습 머리(pixelPoses.drawSideHead)

- 가운데 = 예전 머리 가운데 + 정수리 방향 × 2 → 목 쪽 끝은 예전 5×5 와 같은 자리, 정수리 쪽으로 커진다.
- 칸마다 u(정수리 쪽) · w(얼굴 쪽)를 계산: u ≥ 2 정수리 머리카락, w ≤ -2 뒤통수, u = 1 · w ≥ 0 앞머리, 티어 4+ 는 u = 1 줄이 머리띠.
- 눈 (w 2, u 0 · -1) + 반짝임 (3, 0), 볼 (1, -2), 귀 (-1, -1), 입 (3, -3). 힘주는 프레임은 `>` 눈, 휴식은 감은 눈.

## 작은 그림(engine.drawChar)

```text
..hhhhhh..
.hhhhhhhh.
hhhhhhhhhh
hhsshssshh
hskwsskwsh   k 눈 · w 반짝임
hskksskksh
.pssssssp.   p 볼(Pal.p, 없으면 피부 — 그림자 보스는 볼 없음)
..ssssss..
.srrrrrrs.
.srrrrrrs.
.s.rrrr.s.
..bbbbbb..
+ 다리 4줄(걷기 3프레임)
```

뒷모습은 3~6줄을 머리카락으로, 머리 위 바는 팔을 머리 바깥(x-1 · x+10)으로 세운다.

## diff (렌더러 · 작은 그림 · 옆모습 공용)

chibiArt.ts · pixelPoses.ts 는 길어서 위 규칙으로 대신한다(전체는 git 기록).

```diff
diff --git a/frontend/src/components/avatar/AvatarRenderer.tsx b/frontend/src/components/avatar/AvatarRenderer.tsx
index 08574f3..e6fe4cc 100644
--- a/frontend/src/components/avatar/AvatarRenderer.tsx
+++ b/frontend/src/components/avatar/AvatarRenderer.tsx
@@ -1,7 +1,7 @@
 import { useEffect, useId, useMemo, useState } from "react";
 import { resolveSeedFeatures } from "./seed";
 import { CELL, buildPixelAvatar, type Pose, type PixelAction, type PixelAvatarSpec } from "./pixelAvatar";
-import { bodyStageOf, buildChibi, type ChibiExpression, type ChibiSpec } from "./chibiArt";
+import { CHIBI_FRONT_KINDS, bodyStageOf, buildChibi, type ChibiExpression, type ChibiSpec } from "./chibiArt";
 import type { AvatarSeed, CharacterTier, GrowthParams } from "./types";
 import { defaultGrowthParams } from "./types";
 import { TIER_PRESETS } from "./tierPreset";
@@ -33,7 +33,7 @@ type Props = {
   pumped?: boolean;
   /**
    * 몸 단계 0~5(서버 BodyStage — 근육량 · 레벨 · 활동 레벨 중 가장 높은 것). 없으면 근육량과 진화 단계(레벨)로 짐작한다.
-   * 동작(action)이 없을 때는 치비 그림(chibiArt, 2026-10-20)으로, 운동 동작은 아직 예전 리프터 그림으로 그린다.
+   * 치비 그림(chibiArt, 2026-10-20): 서기 · 알통 · 휴식과 정면 운동 동작 9가지. 옆모습 동작(벤치 · 머신 · 러닝 등)은 pixelPoses 가 큰 머리로 그린다.
    */
   bodyStage?: number | null;
 };
@@ -157,15 +157,28 @@ export default function AvatarRenderer({
     const emblem = resolvedBranch && skills.has("branch") ? BRANCH_COLOR[resolvedBranch] : null;
 
     // 서 있는 캐릭터(카드 · 홈 · 친구 · 모임 등) — 머리 큰 치비 B, 몸 단계 0~5
-    if (resolvedResting || !act) {
+    // 정면 운동 동작(스쿼트 · 데드 · 프레스 · 컬 · 레이즈 · 플라이 · 턱걸이 · 다리 들기 · 알통)도 치비로
+    const chibiAct = act && !resolvedResting && CHIBI_FRONT_KINDS.has(act.kind) ? act : null;
+    if (resolvedResting || !act || chibiAct) {
       const known = bodyStage !== null && bodyStage !== undefined && Number.isFinite(bodyStage);
       const base = known
         ? Math.max(0, Math.min(5, Math.round(bodyStage as number)))
         : bodyStageOf({ muscularity: growth.muscularityNormalized, level: Math.max(1, stage) * 10 + 1, activityLevel: 0 });
       const chibiStage = Math.min(5, base + (pumpedNow ? 1 : 0)) as ChibiSpec["bodyStage"];
       const chibiPose = resolvedResting ? "stand" : pose === "stand" ? "stand" : "flex";
-      const expression: ChibiExpression =
-        resolvedAttendanceRisk !== "normal" ? "tired" : pumpedNow ? "smile" : chibiPose === "flex" || tierStep >= 5 ? "smile" : "normal";
+      const expression: ChibiExpression = chibiAct
+        ? chibiAct.frame === 1
+          ? chibiAct.kind === "flex"
+            ? "smile"
+            : "strain"
+          : "normal"
+        : resolvedAttendanceRisk !== "normal"
+          ? "tired"
+          : pumpedNow
+            ? "smile"
+            : chibiPose === "flex" || tierStep >= 5
+              ? "smile"
+              : "normal";
       return buildChibi({
         variant: "B",
         bodyStage: chibiStage,
@@ -179,6 +192,7 @@ export default function AvatarRenderer({
         resting: resolvedResting,
         emblem,
         pumped: pumpedNow,
+        action: chibiAct,
         skills: { aura: skills.has("aura"), wave: skills.has("wave"), burst: skills.has("burst") },
       });
     }
diff --git a/frontend/src/components/avatar/pixelAvatar.ts b/frontend/src/components/avatar/pixelAvatar.ts
index 1ec8041..23f826c 100644
--- a/frontend/src/components/avatar/pixelAvatar.ts
+++ b/frontend/src/components/avatar/pixelAvatar.ts
@@ -24,7 +24,7 @@ import {
   shade,
   type Palette,
 } from "./pixelGrid";
-import { buildPoseArt, isPoseKind, type PoseKind } from "./pixelPoses";
+import { buildPoseArt, drawSideHead, isPoseKind, type PoseKind } from "./pixelPoses";
 
 export { CELL, GRID_BOTTOM, GRID_LEFT, GRID_RIGHT, GRID_TOP, GRID_W, INK } from "./pixelGrid";
 
@@ -125,7 +125,7 @@ type Box = { x0: number; x1: number; y0: number; y1: number };
 type ArmStyle = "stand" | "flex" | "overhead" | "rack" | "rackLow" | "curl" | "wide" | "front" | "hang";
 
 /** 정면 바벨: y 행에 봉, xIn 열(왼쪽 안쪽 원판의 오른쪽 끝)부터 바깥으로 무거운 원판부터 끼운다 */
-function drawBar(g: Grid, y: number, xIn: number, plates: PixelPlate[]) {
+export function drawBar(g: Grid, y: number, xIn: number, plates: PixelPlate[]) {
   const list = plates.slice(0, MAX_PIXEL_PLATES);
   const widths = list.map((p) => (p.size === 0 ? 2 : 1));
   const total = widths.reduce((a, w) => a + w, 0);
@@ -477,7 +477,7 @@ export function buildPixelAvatar(spec: PixelAvatarSpec): PixelAvatarArt {
 /** 옆모습(머리가 왼쪽): 벤치프레스 · 푸시업. 정면 그림과 같은 색 · 같은 외곽선 규칙 */
 function buildSideArt(spec: PixelAvatarSpec, act: PixelAction, pal: Palette): PixelAvatarArt {
   const g = new Grid();
-  const { skin, hair, tank, shorts, shoe, handColor } = pal;
+  const { skin, tank, shorts, shoe, handColor } = pal;
   const b = spec.build;
   const tier = spec.tierStep;
   const f = act.frame;
@@ -496,14 +496,9 @@ function buildSideArt(spec: PixelAvatarSpec, act: PixelAction, pal: Palette): Pi
     g.rect(7, 14, b >= 2 ? 16 : 17, 20, tank);
     g.rect(15, 18, 17, 20, shorts);
     if (tier >= 2) g.rect(14, 14, 17, 20, tier >= 6 ? "#F0BE2E" : "#6B4A2E");
-    // 목 · 머리(얼굴이 위, 뒤통수가 벤치에)
-    g.rect(6, 6, 18, 20, skin);
-    g.rect(1, 5, 15, 20, skin);
-    g.rect(1, 1, 15, 20, hair);
-    g.rect(1, 5, 20, 20, hair);
-    g.set(5, 15, null);
-    g.set(3, 14, skin); // 코
-    g.set(4, 16, spec.resting ? skin : (spec.eyeColor ?? INK)); // 눈
+    // 목 · 머리(얼굴이 위, 뒤통수가 벤치에) — 치비 큰 머리
+    g.rect(5, 6, 18, 20, skin);
+    face = drawSideHead(g, [3, 18], [-1, 0], [0, -1], pal, { tier, resting: spec.resting, strain: f === 1 && !spec.resting, eye: spec.eyeColor ?? undefined });
     // 팔 · 바벨(프레임 1 은 팔을 다 편 자세)
     const hy = f === 1 ? 7 : 13;
     g.rect(10, 11, hy + 2, 17, skin);
@@ -531,14 +526,9 @@ function buildSideArt(spec: PixelAvatarSpec, act: PixelAction, pal: Palette): Pi
     // 팔(앞쪽)과 손
     g.rect(7, 8, sy + 1, 28, skin);
     g.rect(6, 9, 29, 30, handColor);
-    // 목 · 머리(아래를 본다)
-    g.rect(6, 6, sy - 1, sy, skin);
-    g.rect(1, 5, sy - 4, sy, skin);
-    g.rect(1, 5, sy - 4, sy - 4, hair);
-    g.rect(5, 5, sy - 4, sy - 2, hair);
-    g.set(1, sy, null);
-    g.set(2, sy - 2, spec.resting ? skin : (spec.eyeColor ?? INK)); // 눈
-    face = { x: 1, y: sy - 4, w: 5, h: 5 };
+    // 목 · 머리(앞을 보며 바닥 쪽으로) — 치비 큰 머리
+    g.rect(5, 6, sy - 1, sy, skin);
+    face = drawSideHead(g, [4, sy - 2], [-1, 0], [0, 1], pal, { tier, resting: spec.resting, strain: f === 1 && !spec.resting, eye: spec.eyeColor ?? undefined });
   }
 
   g.outline();
diff --git a/frontend/src/components/gymMap/engine.ts b/frontend/src/components/gymMap/engine.ts
index 8ba24fc..a3b5421 100644
--- a/frontend/src/components/gymMap/engine.ts
+++ b/frontend/src/components/gymMap/engine.ts
@@ -107,12 +107,14 @@ export function toneForMbti(mbti?: string | null): Tone {
   return { skin: "#E8B98F", tank: "#D9302A", hair: "#2B2420" };
 }
 
-export type Pal = Record<"h" | "s" | "k" | "r" | "b" | "w", string>;
-export const palOf = (t: Tone): Pal => ({ h: t.hair, s: t.skin, k: C.ink, r: t.tank, b: "#2C2D31", w: C.chalk });
+/** h 머리 · s 피부 · k 눈(잉크) · r 민소매 · b 반바지 · w 흰색(신발 · 눈 반짝임) · p 볼(없으면 피부색) */
+export type Pal = Record<"h" | "s" | "k" | "r" | "b" | "w", string> & { p?: string };
+export const BLUSH = "#EE9C86";
+export const palOf = (t: Tone): Pal => ({ h: t.hair, s: t.skin, k: C.ink, r: t.tank, b: "#2C2D31", w: C.chalk, p: BLUSH });
 const GUESTS: Pal[] = [
-  { h: "#5A3A22", s: "#F0C7A0", k: C.ink, r: C.blue, b: "#2C2D31", w: C.chalk },
-  { h: "#16161A", s: "#D9A577", k: C.ink, r: C.yellow, b: "#2C2D31", w: C.chalk },
-  { h: "#7A4A2A", s: "#EDBD95", k: C.ink, r: C.green, b: "#3B3D44", w: C.chalk },
+  { h: "#5A3A22", s: "#F0C7A0", k: C.ink, r: C.blue, b: "#2C2D31", w: C.chalk, p: BLUSH },
+  { h: "#16161A", s: "#D9A577", k: C.ink, r: C.yellow, b: "#2C2D31", w: C.chalk, p: BLUSH },
+  { h: "#7A4A2A", s: "#EDBD95", k: C.ink, r: C.green, b: "#3B3D44", w: C.chalk, p: BLUSH },
 ];
 /* ---------- 헬스장 직원 NPC ----------
    실제 회원과 헷갈리지 않게: 모두 같은 조끼 유니폼(색은 꾸미기에서 고름), 이름표는 역할(코치 · 관장님 · 직원 …)만.
@@ -137,6 +139,7 @@ const npcPal = (id: NpcId, look: StaffLook): Pal => ({
   h: look.hair[id as StaffId] ?? EXTRA_HAIR[id] ?? "#1B1B1F",
   s: NPC_SKIN[id],
   k: C.ink,
+  p: BLUSH,
   // 영양사는 흰 가운, 나머지는 헬스장 조끼
   r: id === "dietitian" ? "#E4E2DA" : look.uniform,
   b: "#1C1D20",
@@ -500,9 +503,26 @@ export function paintScenePreview(canvas: HTMLCanvasElement, scene: Exclude<Scen
   g.drawImage(full, 76, scene === "DINER" ? 120 : 0, 104, 88, 0, 0, 104, 88);
 }
 
-/* ---------- 캐릭터 (10×16 픽셀) ---------- */
+/* ---------- 캐릭터 (10×16 픽셀, 2026-10-20 치비) ----------
+   큰 카드 그림(chibiArt)과 같은 비율: 머리 8줄(키의 절반) · 큰 눈 2×2(반짝임 한 칸) · 볼 · 짧은 몸 4줄 · 다리 4줄.
+   글자: h 머리 · s 피부 · k 눈 · w 흰색 · p 볼 · r 민소매 · b 반바지. 외곽선은 잉크로 한 칸 둘러 그린다. */
 
-const BASE = ["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".skssssks.", ".ssssssss.", "..ssssss..", "...ssss...", ".rrrrrrrr.", "srrrrrrrrs", "srrrrrrrrs", "ss.rrrr.ss", "..bbbbbb.."];
+const BASE = [
+  "..hhhhhh..",
+  ".hhhhhhhh.",
+  "hhhhhhhhhh",
+  "hhsshssshh",
+  "hskwsskwsh",
+  "hskksskksh",
+  ".pssssssp.",
+  "..ssssss..",
+  ".srrrrrrs.",
+  ".srrrrrrs.",
+  ".s.rrrr.s.",
+  "..bbbbbb..",
+];
+/** 뒷모습: 얼굴 자리를 머리카락으로, 목덜미만 피부 */
+const BACK = { 3: "hhhhhhhhhh", 4: "hhhhhhhhhh", 5: "hhhhhhhhhh", 6: ".hhhhhhhh.", 7: "..ssssss.." } as Record<number, string>;
 const LEGS = [
   ["..bb..bb..", "..ss..ss..", "..ss..ss..", "..ww..ww.."],
   ["..bb..bb..", "..ss..ss..", "..ww..ss..", "......ww.."],
@@ -510,16 +530,12 @@ const LEGS = [
 ];
 export type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean };
 
-/** 10×16 픽셀 리프터(라운지 광장도 같은 그림) */
+/** 10×16 픽셀 치비(홈 지도 · 라운지 광장 · 던전이 같은 그림) */
 export function drawChar(g: CanvasRenderingContext2D, x: number, y: number, pal: Pal, o: CharOpts = {}) {
   let rows = o.sit ? BASE.slice() : BASE.concat(LEGS[o.frame ?? 0]);
-  if (o.back) {
-    rows = rows.slice();
-    rows[2] = ".hhhhhhhh.";
-    rows[3] = ".hhhhhhhh.";
-    rows[4] = ".shhhhhhs.";
-  }
-  if (o.over) rows = rows.map((row, i) => (i >= 8 && i <= 10 ? `.${row.slice(1, 9)}.` : row));
+  if (o.back) rows = rows.map((row, j) => BACK[j] ?? row);
+  // 머리 위로 바를 든다: 옆 팔을 지우고 머리 바깥으로 팔을 세운다
+  if (o.over) rows = rows.map((row, i) => (i >= 8 && i <= 10 ? `..${row.slice(2, 8)}..` : row));
   g.fillStyle = C.ink;
   rows.forEach((row, j) => {
     for (let i = 0; i < 10; i++)
@@ -529,26 +545,28 @@ export function drawChar(g: CanvasRenderingContext2D, x: number, y: number, pal:
       }
   });
   if (o.over) {
-    fill(g, x - 1, y - 3, 3, 13, C.ink);
-    fill(g, x + 8, y - 3, 3, 13, C.ink);
-    fill(g, x - 7, y - 4, 24, 3, C.ink);
-    fill(g, x - 6, y - 8, 4, 11, C.ink);
-    fill(g, x + 12, y - 8, 4, 11, C.ink);
+    fill(g, x - 2, y - 3, 3, 13, C.ink);
+    fill(g, x + 9, y - 3, 3, 13, C.ink);
+    fill(g, x - 8, y - 4, 26, 3, C.ink);
+    fill(g, x - 7, y - 8, 4, 11, C.ink);
+    fill(g, x + 13, y - 8, 4, 11, C.ink);
   }
   rows.forEach((row, j) => {
     for (let i = 0; i < 10; i++) {
-      const ch = row[i] as keyof Pal | ".";
+      const ch = row[i];
       if (ch === ".") continue;
-      g.fillStyle = pal[ch];
+      g.fillStyle = ch === "p" ? (pal.p ?? pal.s) : pal[ch as keyof Pal] ?? pal.s;
       g.fillRect(x + i, y + j, 1, 1);
     }
   });
   if (o.over) {
-    fill(g, x, y - 2, 1, 11, pal.s);
-    fill(g, x + 9, y - 2, 1, 11, pal.s);
-    fill(g, x - 6, y - 3, 22, 1, "#B9BCC3");
-    fill(g, x - 5, y - 7, 2, 9, C.red);
-    fill(g, x + 13, y - 7, 2, 9, C.red);
+    fill(g, x - 1, y - 2, 1, 11, pal.s);
+    fill(g, x + 10, y - 2, 1, 11, pal.s);
+    fill(g, x, y + 8, 1, 1, pal.s);
+    fill(g, x + 9, y + 8, 1, 1, pal.s);
+    fill(g, x - 7, y - 3, 24, 1, "#B9BCC3");
+    fill(g, x - 6, y - 7, 2, 9, C.red);
+    fill(g, x + 14, y - 7, 2, 9, C.red);
   }
 }
 
```
