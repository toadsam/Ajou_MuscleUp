# 2026-10-20 · 어디서 봐도 같은 캐릭터 — 코드 단위 기록

요약은 [fix-log](../fix-log.md) 같은 날 항목. 앞 단계: [운동 동작 · 작은 그림 치비](2026-10-20-chibi-motions.md).

## 규칙 한 곳: `frontend/src/components/avatar/spriteShape.ts`

카드 그림(`AvatarRenderer` → `chibiArt`)과 같은 값 · 같은 규칙.

| 모양 | 어디서 | 규칙 |
| --- | --- | --- |
| 머리 모양 | `avatarSeed` | `resolveSeedFeatures(seed).hairStyle % 4` (0 기본 · 1 삐죽 · 2 높은 앞머리 · 3 옆으로 넘긴 앞머리) |
| 여자 | `gender` | FEMALE → 머리 모양 짝수 긴 머리 · 홀수 똥머리 |
| 몸 단계 | `bodyStage`(서버 BodyStage) | 없으면 근육량 · 진화 단계로 짐작, 펌핑이면 +1(최대 5) |
| 머리띠 | `tier` | 다이아(4) 이상, 민소매가 빨강이면 파랑 · 아니면 빨강(`chibiArt.headbandFor`) |

`tierStepOf` · `headbandFor` 는 `chibiArt.ts` 로 옮겨 카드 그림(`AvatarRenderer`)과 같이 쓴다.

## 작은 그림 `gymMap/engine.ts drawChar`

- `Pal.shape?: SpriteShape` — 없으면 예전 기본 모양.
- `charCells()` 가 [x, y, 글자] 칸 목록을 만든다: 머리 8줄 + 머리 위 줄(삐죽 · 높은 앞머리 · 똥머리, y < 0) + 몸통 4줄(단계별) + 다리 4줄.
- 몸통: thin(0) `..srrrrs..` · base(1) `.srrrrrrs.` · broad(2~3) `ssrrrrrrss` · huge(4~5) 12칸 `sssrrrrrrsss`(왼쪽 한 칸 밖에서 시작).
- 머리 위 바(`over`)는 x < 2 · x > 7 의 팔 칸을 지우고 머리 바깥 팔을 따로 세운다.

## 화면별 연결

| 화면 | 바뀐 것 |
| --- | --- |
| 홈 지도 | `Home` → `GymMap` 에 `tank` · `shape`(펌핑 포함). `MapState.shape` → `palOf(tone, shape)`. 체험은 고른 성별만 |
| 던전 지도 | `DungeonMap` 이 `spriteShapeOf(character)` → `createDungeon({ shape })` · `setShape`. 그림자 보스는 같은 모양에 머리띠 빼고 어두운 색 |
| 라운지 광장 | `Lounge` 의 `ServerPlayer` 에 시드 · 성별 · 몸 단계 · 펌핑 → `PlazaPlayer.shape` → `toPal` |
| 입장권 | 백엔드 `claims.bs = look.bodyStage()` → 실시간 `profileFromTicket.bodyStage`(0~5, 없으면 비움) |
| 그림자 보스 | `ShadowSprite`: 서기 · 정면 동작은 `buildChibi`(빨간 눈 `eyeColor`, `blush: false`), `bodyStage` prop(`bodyStageFor`) |
| 종목 그림 | `ExerciseIcon`: 정면 동작은 치비(몸 단계 1), 옆모습은 큰 머리 그림 |

## diff (연결 부분)

작은 그림 · chibiArt 는 위 규칙으로 대신한다(전체는 git 기록).

```diff
diff --git a/backend/src/main/java/com/ajou/muscleup/controller/RealtimeTicketController.java b/backend/src/main/java/com/ajou/muscleup/controller/RealtimeTicketController.java
index cf07cbf..5e631e0 100644
--- a/backend/src/main/java/com/ajou/muscleup/controller/RealtimeTicketController.java
+++ b/backend/src/main/java/com/ajou/muscleup/controller/RealtimeTicketController.java
@@ -143,6 +143,7 @@ public class RealtimeTicketController {
         claims.put("pump", look.pumped(System.currentTimeMillis()));
         claims.put("tank", look.tank());
         claims.put("ttl", look.title());
+        claims.put("bs", look.bodyStage()); // 몸 단계 — 라운지 작은 그림을 카드 그림과 같게
         claims.put("fr", friendIds);
         claims.put("room", roomGym == null ? "square" : "gym:" + roomGym.getId());
         claims.put("rname", roomGym == null ? "광장" : truncate(roomGym.getName(), 40));
diff --git a/backend/src/test/java/com/ajou/muscleup/controller/RealtimeTicketRoomTest.java b/backend/src/test/java/com/ajou/muscleup/controller/RealtimeTicketRoomTest.java
index 9bfad8f..44421ad 100644
--- a/backend/src/test/java/com/ajou/muscleup/controller/RealtimeTicketRoomTest.java
+++ b/backend/src/test/java/com/ajou/muscleup/controller/RealtimeTicketRoomTest.java
@@ -91,6 +91,8 @@ class RealtimeTicketRoomTest {
                 .andExpect(jsonPath("$.room").value("square"))
                 .andReturn().getResponse().getContentAsString();
         assertThat(claimsOf(res)).contains("\"room\":\"square\"");
+        // 몸 단계(라운지 작은 그림을 카드 그림과 같게) — 갓 시작한 사람은 0
+        assertThat(claimsOf(res)).contains("\"bs\":0");
     }
 
     @Test
diff --git a/frontend/src/components/boss/BossFight.tsx b/frontend/src/components/boss/BossFight.tsx
index a105225..a8fe97e 100644
--- a/frontend/src/components/boss/BossFight.tsx
+++ b/frontend/src/components/boss/BossFight.tsx
@@ -5,6 +5,7 @@ import type { ActionKind, Equip, PixelAction, PixelPlate } from "../avatar/pixel
 import type { StageCharacter } from "../workout/LiftStage";
 import HpBar from "./HpBar";
 import ShadowSprite from "./ShadowSprite";
+import { bodyStageFor } from "../avatar/spriteShape";
 import { spawnChalk } from "../../lib/chalkBurst";
 import { SHADOW_DAILY_CAP, SOURCE_LABEL, type ShadowHit } from "../../lib/shadow";
 
@@ -291,6 +292,7 @@ export default function BossFight({ hit, character, mbti, motion, replayKey = 0,
               key={contact ? `fx-${replayKey}-${contact.index}` : `fx-${replayKey}-${stage}`}
               avatarSeed={character?.avatarSeed ?? "shadow"}
               build={buildOf(character)}
+              bodyStage={character ? bodyStageFor(character) : null}
               female={character?.gender === "FEMALE"}
               action={shadowAction}
               size={104}
diff --git a/frontend/src/components/boss/DungeonStage.tsx b/frontend/src/components/boss/DungeonStage.tsx
index 503f0ff..2aa06bc 100644
--- a/frontend/src/components/boss/DungeonStage.tsx
+++ b/frontend/src/components/boss/DungeonStage.tsx
@@ -5,6 +5,7 @@ import type { StageCharacter } from "../workout/LiftStage";
 import HpBar from "./HpBar";
 import ImpactMark, { FloorCrack } from "./ImpactMark";
 import ShadowSprite from "./ShadowSprite";
+import { bodyStageFor } from "../avatar/spriteShape";
 import MobSprite from "../dungeon/MobSprite";
 import { SHARDS, buildOf, prefersReducedMotion, splitShares } from "./fightParts";
 import { spawnChalk } from "../../lib/chalkBurst";
@@ -314,6 +315,7 @@ export default function DungeonStage({ character, mbti, hp, remaining, hit, play
                 key={contact ? `sh-${playKey}-${contact.index}` : `sh-${playKey}-${phase}-${entering}`}
                 avatarSeed={character?.avatarSeed ?? "shadow"}
                 build={buildOf(character)}
+              bodyStage={character ? bodyStageFor(character) : null}
                 female={character?.gender === "FEMALE"}
                 action={shadowAction}
                 size={100}
diff --git a/frontend/src/components/boss/ShadowSprite.tsx b/frontend/src/components/boss/ShadowSprite.tsx
index 7bfd101..be150b3 100644
--- a/frontend/src/components/boss/ShadowSprite.tsx
+++ b/frontend/src/components/boss/ShadowSprite.tsx
@@ -1,8 +1,10 @@
 import { useMemo } from "react";
 import { CELL, buildPixelAvatar, type PixelAction } from "../avatar/pixelAvatar";
+import { CHIBI_FRONT_KINDS, buildChibi } from "../avatar/chibiArt";
 import { resolveSeedFeatures } from "../avatar/seed";
 
-// 그림자 — 내 캐릭터와 같은 픽셀 리프터를 어두운 색으로 그린다(새 픽셀 아트 없음). 눈만 빨간 원판 색.
+// 그림자 — 내 캐릭터와 같은 치비(머리 모양 · 성별 · 몸 단계)를 어두운 색으로 그린다. 눈만 빨간 원판 색, 볼터치 없음.
+// 서 있기 · 정면 동작은 chibiArt, 옆모습 동작(벤치 · 러닝 등)은 pixelPoses 의 큰 머리 그림(2026-10-20).
 // 피격 동작은 내 동작의 프레임 1 을 고정해 "맞고 버티는" 모습. 옆모습 동작은 좌우를 뒤집어 나와 마주 보게 한다.
 
 const SHADOW_COLORS = { skin: "#26272B", hair: "#1A1A1C", tank: "#3A3D43", eye: "#D9302A" };
@@ -13,8 +15,10 @@ const SIDE_KINDS = new Set(["bench", "pushup", "legpress", "legcurl", "legext",
 type Props = {
   /** 내 캐릭터 시드 — 머리 모양을 따라가 "나의 그림자"가 된다 */
   avatarSeed: string;
-  /** 근육 단계 0~3 (내 캐릭터와 같게) */
+  /** 근육 단계 0~3 (옆모습 동작용, 내 캐릭터와 같게) */
   build?: 0 | 1 | 2 | 3;
+  /** 몸 단계 0~5 (치비, 내 캐릭터와 같게 — avatar/spriteShape.bodyStageFor) */
+  bodyStage?: number | null;
   female?: boolean;
   action?: PixelAction | null;
   size?: number;
@@ -23,11 +27,27 @@ type Props = {
   className?: string;
 };
 
-export default function ShadowSprite({ avatarSeed, build = 1, female = false, action = null, size = 96, shadow = true, className = "" }: Props) {
+export default function ShadowSprite({ avatarSeed, build = 1, bodyStage = null, female = false, action = null, size = 96, shadow = true, className = "" }: Props) {
   const actionKey = action ? JSON.stringify(action) : "";
   const art = useMemo(() => {
     const seed = resolveSeedFeatures(avatarSeed || "shadow");
     const act = actionKey ? (JSON.parse(actionKey) as PixelAction) : null;
+    if (!act || CHIBI_FRONT_KINDS.has(act.kind)) {
+      const stage = Math.max(0, Math.min(5, Math.round(bodyStage ?? build + 1))) as 0 | 1 | 2 | 3 | 4 | 5;
+      return buildChibi({
+        variant: "B",
+        bodyStage: stage,
+        fat: 0,
+        female,
+        hairStyle: seed.hairStyle,
+        expression: act && act.frame === 1 && act.kind !== "flex" ? "strain" : "normal",
+        pose: "stand",
+        colors: { skin: SHADOW_COLORS.skin, hair: SHADOW_COLORS.hair, tank: SHADOW_COLORS.tank },
+        eyeColor: SHADOW_COLORS.eye,
+        blush: false,
+        action: act,
+      });
+    }
     return buildPixelAvatar({
       build,
       fat: 0,
@@ -45,7 +65,7 @@ export default function ShadowSprite({ avatarSeed, build = 1, female = false, ac
       skills: { aura: false, wave: false, burst: false },
       action: act,
     });
-  }, [avatarSeed, build, female, actionKey]);
+  }, [avatarSeed, build, bodyStage, female, actionKey]);
 
   const flip = action ? SIDE_KINDS.has(action.kind) : false;
   const y = (row: number) => row * CELL;
diff --git a/frontend/src/components/dungeon/DungeonMap.tsx b/frontend/src/components/dungeon/DungeonMap.tsx
index 820759d..e303910 100644
--- a/frontend/src/components/dungeon/DungeonMap.tsx
+++ b/frontend/src/components/dungeon/DungeonMap.tsx
@@ -7,6 +7,8 @@ import TimingGauge from "../boss/TimingGauge";
 import ShadowShareEditor from "../boss/ShadowShareEditor";
 import Joystick from "./Joystick";
 import { createDungeon, type DungeonController, type EncounterTarget } from "./dungeonWorld";
+import { spriteShapeOf } from "../avatar/spriteShape";
+import { toneForMbti } from "../gymMap/engine";
 import { barbellLoad } from "../../lib/liftMotion";
 import { friendlyError } from "../../lib/httpError";
 import { toast } from "../../lib/toast";
@@ -51,12 +53,20 @@ export default function DungeonMap({ status, character, mbti, tank, strike, onEx
 
   const plates = useMemo(() => barbellLoad(Math.max(40, Math.min(140, Math.round(view.stats.strengthKg / 3 / 5) * 5))).pixel, [view.stats.strengthKg]);
 
+  // 지도 위 작은 내 캐릭터 모양 — 카드 그림과 같은 머리 · 성별 · 몸 단계 · 머리띠
+  const shape = useMemo(() => (character ? spriteShapeOf(character, tank ?? toneForMbti(mbti).tank) : null), [character, tank, mbti]);
+  const shapeRef = useRef(shape);
+  shapeRef.current = shape;
+  useEffect(() => {
+    ctl.current?.setShape(shape);
+  }, [shape]);
+
   // 지도 만들기(한 번)
   const encounterRef = useRef<(t: EncounterTarget) => void>(() => {});
   useEffect(() => {
     const c = canvasRef.current;
     if (!c) return;
-    const d = createDungeon(c, { mbti, tank }, {
+    const d = createDungeon(c, { mbti, tank, shape: shapeRef.current }, {
       onEncounter: (t) => encounterRef.current(t),
       onExitZone: setAtExit,
     });
diff --git a/frontend/src/components/dungeon/dungeonWorld.ts b/frontend/src/components/dungeon/dungeonWorld.ts
index 414abe2..a481d1e 100644
--- a/frontend/src/components/dungeon/dungeonWorld.ts
+++ b/frontend/src/components/dungeon/dungeonWorld.ts
@@ -5,7 +5,7 @@
 // 이동: 조이스틱 · 방향키 · WASD 는 누르는 동안 계속(84px/초), 바닥 탭은 길찾기, 몬스터 탭은 그 옆까지 걸어감.
 // 몬스터는 2~4칸을 천천히 왕복할 뿐 쫓아오지 않는다. 닿으면 onEncounter(한 번), 멀어지면(28px) 다시 닿을 수 있다.
 // React 는 HUD · 조이스틱 · 전투 창을 맡고, 이 파일은 그림 · 걷기 · 순찰 · 닿음만 맡는다. 전투 중(paused)엔 멈춘다.
-import { drawChar, palOf, toneForMbti, type Pal } from "../gymMap/engine";
+import { drawChar, palOf, toneForMbti, type Pal, type SpriteShape } from "../gymMap/engine";
 import { artSize, drawMob } from "./mobArt";
 
 export const TILE = 16;
@@ -221,12 +221,14 @@ export type DungeonController = {
   /** 전투가 끝나고 지도로 돌아올 때: 그 상대에서 한 걸음 물러선다 */
   stepBack: () => void;
   destroy: () => void;
+  /** 내 캐릭터 모양(카드 그림과 같게) — 캐릭터 정보가 늦게 와도 지도를 다시 만들지 않고 바꾼다. 그림자 보스도 같은 모양 */
+  setShape: (shape: SpriteShape | null) => void;
   /** 개발 확인용 */
   debug: () => { x: number; y: number; paused: boolean; mobs: { id: number; x: number; y: number; killed: boolean }[] };
   teleport: (x: number, y: number) => void;
 };
 
-export function createDungeon(canvas: HTMLCanvasElement, me: { mbti?: string | null; tank?: string | null }, cb: DungeonCallbacks): DungeonController {
+export function createDungeon(canvas: HTMLCanvasElement, me: { mbti?: string | null; tank?: string | null; shape?: SpriteShape | null }, cb: DungeonCallbacks): DungeonController {
   const g = canvas.getContext("2d")!;
   const bg = document.createElement("canvas");
   bg.width = WORLD_W;
@@ -234,8 +236,11 @@ export function createDungeon(canvas: HTMLCanvasElement, me: { mbti?: string | n
   paintDungeon(bg.getContext("2d")!);
 
   const tone = toneForMbti(me.mbti);
-  const myPal: Pal = palOf(me.tank ? { ...tone, tank: me.tank } : tone);
-  const shadowPal: Pal = { h: "#1A1A1C", s: "#26272B", k: C.red, r: "#3A3D43", b: "#1F2024", w: "#3C3E44" };
+  const myTone = me.tank ? { ...tone, tank: me.tank } : tone;
+  let myPal: Pal = palOf(myTone, me.shape);
+  // 그림자 보스 = 나의 그림자: 같은 머리 · 몸, 어두운 색 · 빨간 눈(머리띠 · 볼은 없다)
+  const shadowOf = (shape: SpriteShape | null | undefined): Pal => ({ h: "#1A1A1C", s: "#26272B", k: C.red, r: "#3A3D43", b: "#1F2024", w: "#3C3E44", shape: shape ? { ...shape, band: null } : null });
+  let shadowPal: Pal = shadowOf(me.shape);
 
   const player = { x: START[0], y: START[1], path: [] as [number, number][], step: 0, back: true };
   let mobs: MobActor[] = [];
@@ -522,6 +527,10 @@ export function createDungeon(canvas: HTMLCanvasElement, me: { mbti?: string | n
   raf = requestAnimationFrame(loop);
 
   return {
+    setShape(shape) {
+      myPal = palOf(myTone, shape);
+      shadowPal = shadowOf(shape);
+    },
     setMobs(list) {
       const prev = new Map(mobs.map((m) => [m.id, m]));
       mobs = list.map((m) => {
diff --git a/frontend/src/components/gymMap/GymMap.tsx b/frontend/src/components/gymMap/GymMap.tsx
index dcc94b1..d9c490c 100644
--- a/frontend/src/components/gymMap/GymMap.tsx
+++ b/frontend/src/components/gymMap/GymMap.tsx
@@ -5,6 +5,7 @@ import { DUNGEON_PATH } from "../../lib/shadow";
 import { barbellWeight } from "../gym/plates";
 import { logEvent } from "../../utils/analytics";
 import AvatarRenderer from "../avatar/AvatarRenderer";
+import type { SpriteShape } from "./engine";
 import { loadGuestCharacter, saveGuestCharacter, type GuestCharacter } from "./guestCharacter";
 import {
   DEFAULT_LAYOUT,
@@ -61,6 +62,9 @@ type Props = {
   /** 거울 앞에서 보여 줄 내 캐릭터(AvatarRenderer) */
   avatar?: ReactNode;
   mbti?: string | null;
+  /** 지도 위 작은 내 캐릭터: 장착한 민소매 색 · 모양(머리 · 성별 · 몸 단계 · 머리띠) — 카드 그림과 같게 */
+  tank?: string | null;
+  shape?: SpriteShape | null;
   weekDays: number;
   streak: number;
   monthCount?: number | null;
@@ -169,6 +173,14 @@ export default function GymMap(props: Props) {
   const weekDays = isGuest ? (trialDone ? 1 : 0) : props.weekDays;
   const checkedToday = isGuest ? trialDone : props.checkedToday;
   const mbti = isGuest ? (building ? draft.mbti : guest?.mbti) : props.mbti;
+  // 지도 위 작은 캐릭터 — 로그인하면 카드 그림과 같은 민소매 · 모양, 체험은 고른 성별만
+  const { tank: myTank, shape: myShape } = props;
+  const guestFemale = (building ? draft : guest)?.gender === "FEMALE";
+  const tone = useMemo(() => {
+    const base = toneForMbti(mbti);
+    return !isGuest && myTank ? { ...base, tank: myTank } : base;
+  }, [mbti, isGuest, myTank]);
+  const shape = useMemo<SpriteShape | null>(() => (isGuest ? { hair: 0, female: guestFemale, stage: 1 } : (myShape ?? null)), [isGuest, guestFemale, myShape]);
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const wrapRef = useRef<HTMLDivElement>(null);
   const meRef = useRef<HTMLDivElement>(null);
@@ -267,7 +279,7 @@ export default function GymMap(props: Props) {
     if (!canvas) return;
     const map = createGymMap(
       canvas,
-      { plates: weekDays, checked: checkedToday, loungeCount: loungeCount ?? 0, tone: toneForMbti(mbti) },
+      { plates: weekDays, checked: checkedToday, loungeCount: loungeCount ?? 0, tone, shape },
       {
         onZone: (z) => {
           if (z === "exit") {
@@ -337,8 +349,8 @@ export default function GymMap(props: Props) {
   }, []);
 
   useEffect(() => {
-    mapRef.current?.setState({ plates: weekDays, checked: checkedToday, loungeCount: loungeCount ?? 0, tone: toneForMbti(mbti) });
-  }, [weekDays, checkedToday, loungeCount, mbti]);
+    mapRef.current?.setState({ plates: weekDays, checked: checkedToday, loungeCount: loungeCount ?? 0, tone, shape });
+  }, [weekDays, checkedToday, loungeCount, tone, shape]);
 
   useEffect(() => {
     if (!loggedIn) {
diff --git a/frontend/src/components/lounge/plaza.ts b/frontend/src/components/lounge/plaza.ts
index 7a1cd64..86c1df3 100644
--- a/frontend/src/components/lounge/plaza.ts
+++ b/frontend/src/components/lounge/plaza.ts
@@ -5,7 +5,7 @@
 // 아래: 잔디 · 나무 · 남쪽 입구(처음 서는 곳).
 // 사람 그림은 홈 지도와 같은 10×16 리프터(drawChar). 이름표 · 말풍선 · 이모트는 캔버스에 같이 그린다.
 // 위치는 월드 픽셀(발 가운데)로 주고받는다 — 실시간 서버는 x · y 를 받아 범위만 자르고 그대로 전한다.
-import { drawChar, palOf, toneForMbti, type Pal } from "../gymMap/engine";
+import { drawChar, palOf, toneForMbti, type Pal, type SpriteShape } from "../gymMap/engine";
 
 export const TILE = 16;
 export const COLS = 28;
@@ -443,6 +443,8 @@ export type PlazaPlayer = {
   level?: number;
   mbti?: string | null;
   tank?: string | null;
+  /** 머리 · 성별 · 몸 단계 · 머리띠(카드 그림과 같게, 입장권 값으로) */
+  shape?: SpriteShape | null;
   x: number;
   y: number;
 };
@@ -471,9 +473,9 @@ export type PlazaController = {
   destroy: () => void;
 };
 
-const toPal = (p: Pick<PlazaPlayer, "mbti" | "tank">): Pal => {
+const toPal = (p: Pick<PlazaPlayer, "mbti" | "tank" | "shape">): Pal => {
   const tone = toneForMbti(p.mbti);
-  return palOf(p.tank ? { ...tone, tank: p.tank } : tone);
+  return palOf(p.tank ? { ...tone, tank: p.tank } : tone, p.shape);
 };
 
 const inWorld = (x: number, y: number) => x > 0 && y > 0 && x < WORLD_W && y < WORLD_H && walkable(Math.floor(x / TILE), Math.floor(y / TILE));
diff --git a/frontend/src/pages/Home.tsx b/frontend/src/pages/Home.tsx
index 39b9b1f..f3a7d57 100644
--- a/frontend/src/pages/Home.tsx
+++ b/frontend/src/pages/Home.tsx
@@ -1,6 +1,8 @@
 ﻿import { useCallback, useEffect, useMemo, useState } from "react";
 import { Link } from "react-router-dom";
 import AvatarRenderer from "../components/avatar/AvatarRenderer";
+import { spriteShapeOf } from "../components/avatar/spriteShape";
+import { toneForMbti } from "../components/gymMap/engine";
 import CountUp from "../components/gym/CountUp";
 import GymMap from "../components/gymMap/GymMap";
 import type { GrowthParams } from "../components/avatar/types";
@@ -356,6 +358,11 @@ export default function Home() {
   }, [logs]);
 
   const todayLog = useMemo(() => logMap.get(todayKey), [logMap, todayKey]);
+  // 지도 위 작은 내 캐릭터 모양(카드 그림과 같은 머리 · 성별 · 몸 단계 · 머리띠)
+  const mapShape = useMemo(
+    () => (character ? spriteShapeOf({ ...character, pumped: (character.pumpedUntil ?? 0) > Date.now() }, character.tank ?? toneForMbti(mbti).tank) : null),
+    [character, mbti],
+  );
   const isAttendanceDone = Boolean(todayLog);
   const todayLabel = todayLog
     ? todayLog.didWorkout
@@ -509,6 +516,8 @@ export default function Home() {
                 ) : undefined
               }
               mbti={mbti}
+              tank={character?.tank ?? null}
+              shape={mapShape}
               weekDays={weekStats.workoutDays}
               streak={summary?.currentStreak ?? 0}
               monthCount={summary?.monthWorkoutCount}
diff --git a/frontend/src/pages/Lounge.tsx b/frontend/src/pages/Lounge.tsx
index a4763cc..c989c60 100644
--- a/frontend/src/pages/Lounge.tsx
+++ b/frontend/src/pages/Lounge.tsx
@@ -2,6 +2,8 @@
 import { io, type Socket } from "socket.io-client";
 import LiveZone from "../components/lounge/LiveZone";
 import { plazaThemeOf } from "../components/lounge/plaza";
+import { spriteShapeOf } from "../components/avatar/spriteShape";
+import { toneForMbti } from "../components/gymMap/engine";
 import PlazaView, { type EmoteKind, type PlazaEmote, type PlazaMessage, type PlazaPlayerInfo } from "../components/lounge/PlazaView";
 import { REALTIME_URL, realtimeAuthFor, realtimeConnectError, type LoungeRoom } from "../lib/realtime";
 import { useCurrentGym, useMyGyms } from "../lib/currentGym";
@@ -23,6 +25,13 @@ type ServerPlayer = {
   mbti?: string;
   tank?: string;
   title?: string;
+  /** 캐릭터 모양 재료(입장권에서 온 값) — 작은 그림을 카드 그림과 같게 */
+  avatarSeed?: string;
+  gender?: string;
+  evolutionStage?: number;
+  growthParams?: { muscularityNormalized?: number } | null;
+  isPumped?: boolean;
+  bodyStage?: number;
   x: number;
   y: number;
 };
@@ -33,12 +42,16 @@ const API_BASE = import.meta.env.VITE_API_BASE ?? "";
 const MUTED_KEY = "lounge_muted_users_v1";
 const MAX_MESSAGES = 80;
 
+/** 작은 그림 모양: 카드 그림과 같은 규칙(머리 모양 시드 · 성별 · 몸 단계 + 펌핑 · 티어 머리띠) */
+const shapeOf = (p: ServerPlayer) => spriteShapeOf({ ...p, pumped: p.isPumped }, p.tank ?? toneForMbti(p.mbti).tank);
+
 const toInfo = (p: ServerPlayer): PlazaPlayerInfo => ({
   id: p.socketId,
   name: p.nickname,
   level: p.level,
   mbti: p.mbti ?? null,
   tank: p.tank ?? null,
+  shape: shapeOf(p),
   title: p.title ?? null,
   tier: p.tier ?? null,
   x: p.x,
@@ -266,7 +279,7 @@ export default function Lounge() {
           ? { board: { body: "우리 모임 공지 · 일정 · 멤버는 모임 페이지에 있어요.", to: `/g/${loungeGym.slug}`, cta: "모임 페이지" } }
           : undefined
       }
-      me={{ id: me.socketId, name: me.nickname, level: me.level, mbti: me.mbti ?? null, tank: me.tank ?? null }}
+      me={{ id: me.socketId, name: me.nickname, level: me.level, mbti: me.mbti ?? null, tank: me.tank ?? null, shape: shapeOf(me) }}
       start={lastPos.current ? [lastPos.current.x, lastPos.current.y] : undefined}
       players={others}
       messages={shownMessages}
diff --git a/frontend/src/pages/ShadowBoss.tsx b/frontend/src/pages/ShadowBoss.tsx
index 50a92f0..1070b0e 100644
--- a/frontend/src/pages/ShadowBoss.tsx
+++ b/frontend/src/pages/ShadowBoss.tsx
@@ -4,6 +4,7 @@ import AvatarRenderer from "../components/avatar/AvatarRenderer";
 import BossFight, { type FightMotion } from "../components/boss/BossFight";
 import HpBar from "../components/boss/HpBar";
 import ShadowSprite from "../components/boss/ShadowSprite";
+import { bodyStageFor } from "../components/avatar/spriteShape";
 import { PlateIcon } from "../components/boss/SkillPlates";
 import ShadowShareEditor from "../components/boss/ShadowShareEditor";
 import type { StageCharacter } from "../components/workout/LiftStage";
@@ -201,7 +202,7 @@ export default function ShadowBoss() {
               </div>
               <span className="relative z-10 self-center font-num text-2xl text-steel-600">VS</span>
               <div className="relative z-10 flex h-full w-[118px] items-end justify-center">
-                <ShadowSprite avatarSeed={character?.avatarSeed ?? "shadow"} female={character?.gender === "FEMALE"} size={104} />
+                <ShadowSprite avatarSeed={character?.avatarSeed ?? "shadow"} female={character?.gender === "FEMALE"} bodyStage={character ? bodyStageFor(character) : null} size={104} />
               </div>
             </div>
             <div className="mt-3">
diff --git a/realtime/src/auth.ts b/realtime/src/auth.ts
index ddfdde1..40cfd20 100644
--- a/realtime/src/auth.ts
+++ b/realtime/src/auth.ts
@@ -34,6 +34,8 @@ export type TicketClaims = {
   /** 도감에서 장착한 민소매 색 #RRGGBB · 칭호 */
   tank?: string | null;
   ttl?: string | null;
+  /** 몸 단계 0~5(백엔드 BodyStage) — 작은 그림을 카드 그림과 같게 */
+  bs?: number;
   fr: number[];
   /** lounge room: "square" | "gym:{id}" (older tickets: missing = square) */
   room?: string;
diff --git a/realtime/src/server.ts b/realtime/src/server.ts
index 26efb46..a70ce52 100644
--- a/realtime/src/server.ts
+++ b/realtime/src/server.ts
@@ -141,6 +141,7 @@ const profileFromTicket = (claims: TicketClaims): VerifiedProfile => ({
   isPumped: claims.pump === true,
   tank: typeof claims.tank === "string" && /^#[0-9A-Fa-f]{6}$/.test(claims.tank) ? claims.tank : undefined,
   title: cleanText(claims.ttl, 20),
+  bodyStage: typeof claims.bs === "number" ? asInt(claims.bs, 0, 5, 0) : undefined,
 });
 
 /** dev mode only (no secret, not production): unverified guest profile from the client payload */
diff --git a/realtime/src/types.ts b/realtime/src/types.ts
index e963a4d..9d6b3d5 100644
--- a/realtime/src/types.ts
+++ b/realtime/src/types.ts
@@ -73,6 +73,8 @@ export type PlayerState = {
   isPumped?: boolean;
   tank?: string;
   title?: string;
+  /** 몸 단계 0~5 (입장권에서만) */
+  bodyStage?: number;
   recentAttendanceCount?: number;
   activeEventTitle?: string;
   activeEventProgress?: string;
@@ -97,6 +99,7 @@ export type VerifiedProfile = Pick<
   | "isPumped"
   | "tank"
   | "title"
+  | "bodyStage"
 >;
 
 /** Self-described, cosmetic fields the client may still send (validated + length-limited). */
```
