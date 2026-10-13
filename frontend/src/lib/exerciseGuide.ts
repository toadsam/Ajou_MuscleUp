// 종목마다 한 줄 자세 팁 · 주로 쓰는 근육. 종목 그림(ExerciseIcon) 옆에 보여 준다.
// 기본 종목 코드는 서버 LiftExercise 와 같다. 직접 추가한 종목은 부위별 공통 팁.
import type { LiftCategory, LiftExerciseInfo } from "./lifts";

export type ExerciseGuide = { target: string; tip: string };

const GUIDES: Record<string, ExerciseGuide> = {
  SQUAT: { target: "허벅지 앞 · 엉덩이", tip: "발 전체로 바닥을 누르고, 무릎은 발끝 방향으로 밀면서 엉덩이를 뒤로 앉아요." },
  BENCH: { target: "가슴 · 삼두 · 어깨 앞", tip: "날개뼈를 모아 벤치에 붙이고, 바를 가슴 아래쪽에 닿게 내렸다 밀어요." },
  DEADLIFT: { target: "엉덩이 · 허벅지 뒤 · 등", tip: "바를 정강이에 붙이고 등을 곧게 편 채, 바닥을 밀어내듯 일어나요." },
  OHP: { target: "어깨 · 삼두", tip: "배와 엉덩이에 힘을 주고, 바가 얼굴 앞을 지나 머리 위 일직선이 되게 밀어요." },
  ROW: { target: "등 가운데 · 광배", tip: "허리를 곧게 숙인 채 바를 배꼽 쪽으로, 팔꿈치를 뒤로 당겨요." },
  INCLINE_BENCH: { target: "윗가슴 · 어깨 앞", tip: "벤치를 30~45도로 두고, 바를 쇄골 아래쪽으로 내렸다 밀어요." },
  LEG_PRESS: { target: "허벅지 앞 · 엉덩이", tip: "허리가 등받이에서 뜨지 않을 만큼만 내리고, 무릎을 끝까지 잠그지 않아요." },
  LAT_PULLDOWN: { target: "광배 · 이두", tip: "가슴을 내밀고, 바를 쇄골 쪽으로 팔꿈치를 옆구리로 끌어내려요." },
  FRONT_SQUAT: { target: "허벅지 앞 · 코어", tip: "바를 쇄골 위에 얹고 팔꿈치를 높게 든 채, 상체를 세우고 앉아요." },
  ROMANIAN_DEADLIFT: { target: "허벅지 뒤 · 엉덩이", tip: "무릎은 살짝만 굽히고, 엉덩이를 뒤로 빼며 허벅지 뒤가 당길 때까지 내려요." },
  LUNGE: { target: "허벅지 · 엉덩이", tip: "앞발 뒤꿈치로 버티고, 뒷무릎이 바닥에 닿기 직전까지 곧게 내려가요." },
  LEG_EXTENSION: { target: "허벅지 앞", tip: "등을 등받이에 붙이고, 위에서 1초 멈췄다 천천히 내려요." },
  LEG_CURL: { target: "허벅지 뒤", tip: "엉덩이가 들리지 않게 누르고, 발뒤꿈치를 엉덩이 쪽으로 끝까지 당겨요." },
  CALF_RAISE: { target: "종아리", tip: "발뒤꿈치를 충분히 내렸다가 발끝으로 끝까지 올라가 잠깐 멈춰요." },
  DB_BENCH: { target: "가슴 · 삼두", tip: "덤벨을 가슴 옆까지 깊게 내리고, 위에서 두 덤벨이 가까워지게 밀어요." },
  CHEST_FLY: { target: "가슴", tip: "팔꿈치를 살짝 굽힌 채 큰 원을 그리듯 벌렸다 가슴 앞에서 모아요." },
  CABLE_CROSSOVER: { target: "가슴 안쪽", tip: "몸을 살짝 숙이고, 두 손을 가슴 앞에서 끌어안듯 모아 1초 조여요." },
  DIPS: { target: "가슴 아래 · 삼두", tip: "어깨를 귀에서 멀리 두고, 팔꿈치가 90도쯤 될 때까지만 내려가요." },
  PUSH_UP: { target: "가슴 · 삼두 · 코어", tip: "머리부터 발끝까지 일직선을 지키고, 가슴이 바닥 가까이 갈 때까지 내려요." },
  PULL_UP: { target: "광배 · 이두", tip: "어깨를 먼저 내리고, 가슴을 바 쪽으로 끌어올려 턱이 바를 넘게 해요." },
  SEATED_ROW: { target: "등 가운데 · 광배", tip: "상체를 세운 채 손잡이를 배꼽 쪽으로 당기고, 날개뼈를 모아요." },
  DB_ROW: { target: "광배 · 등 가운데", tip: "벤치에 손을 짚고 등을 평평하게, 덤벨을 엉덩이 쪽으로 당겨 올려요." },
  DB_SHOULDER_PRESS: { target: "어깨 · 삼두", tip: "덤벨을 귀 높이에서 시작해, 머리 위에서 서로 가까워지게 밀어요." },
  LATERAL_RAISE: { target: "어깨 옆", tip: "팔꿈치를 살짝 굽히고, 어깨 높이까지만 옆으로 들어 올려요." },
  REAR_DELT_FLY: { target: "어깨 뒤 · 등 위", tip: "상체를 숙이고, 팔을 옆으로 벌리며 날개뼈는 너무 모으지 않아요." },
  BARBELL_CURL: { target: "이두", tip: "팔꿈치를 옆구리에 고정하고, 몸을 흔들지 않고 들어 올려요." },
  DB_CURL: { target: "이두", tip: "팔꿈치를 고정하고, 올리면서 새끼손가락 쪽을 바깥으로 돌려요." },
  TRICEP_PUSHDOWN: { target: "삼두", tip: "팔꿈치를 옆구리에 붙인 채, 손잡이를 허벅지까지 끝까지 밀어 내려요." },
  SKULL_CRUSHER: { target: "삼두", tip: "위팔은 세워 둔 채 팔꿈치만 굽혀, 바를 이마 위로 천천히 내려요." },
  CRUNCH: { target: "복근", tip: "허리는 바닥에 붙이고, 갈비뼈를 골반 쪽으로 말아 올리듯 어깨만 들어요." },
  HANGING_LEG_RAISE: { target: "복근 아래 · 고관절", tip: "몸이 흔들리지 않게 버티고, 골반을 말아 올리듯 무릎을 들어요." },
};

const BY_CATEGORY: Record<LiftCategory, ExerciseGuide> = {
  LEGS: { target: "하체", tip: "무릎이 발끝 방향을 따라가게 하고, 천천히 내려가요." },
  CHEST: { target: "가슴", tip: "날개뼈를 모으고, 가슴이 늘어나는 느낌을 끝까지 가져가요." },
  BACK: { target: "등", tip: "팔보다 팔꿈치로 당긴다는 느낌으로, 등이 굽지 않게 해요." },
  SHOULDERS: { target: "어깨", tip: "어깨가 귀 쪽으로 으쓱 올라가지 않게 눌러 두고 움직여요." },
  ARMS: { target: "팔", tip: "팔꿈치 위치를 고정하고, 반동 없이 천천히 움직여요." },
  CORE: { target: "복근 · 코어", tip: "허리가 꺾이지 않게 배에 힘을 주고, 숨을 내쉬며 조여요." },
  OTHER: { target: "직접 추가한 종목", tip: "무게보다 자세를 먼저, 천천히 정확하게 해요." },
};

export const exerciseGuide = (info: LiftExerciseInfo): ExerciseGuide =>
  GUIDES[info.code] ?? BY_CATEGORY[info.category] ?? BY_CATEGORY.OTHER;
