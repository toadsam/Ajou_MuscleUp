// 던전 잡몹 픽셀 그림(docs/design/shadow-dungeon-map.md 3.1) — 지도(캔버스)와 전투 창(SVG)이 같은 데이터를 쓴다.
// 글자 하나 = 1픽셀. k 는 잉크 테두리, 나머지는 각 몬스터의 팔레트. "." 은 비움.
// 새 그림은 이 다섯 개뿐(짐 플로어 v2 색 · 블러 · 글로우 없음).

export type MobArt = { rows: string[]; pal: Record<string, string> };

const INK = "#0E0E10";

export const MOB_ART: Record<string, MobArt> = {
  // 내일부터: 빨간 머리띠 달력 한 장에 다리. 졸린 눈
  TOMORROW: {
    rows: [
      "..k......k..",
      ".kRk....kRk.",
      "kkkkkkkkkkkk",
      "kRRRRRRRRRRk",
      "kRRRRRRRRRRk",
      "kWWWWWWWWWWk",
      "kWWkkWWkkWWk",
      "kWWWWWWWWWWk",
      "kWWWWkkWWWWk",
      "kWGGWWWWGGWk",
      "kWWWWWWWWWWk",
      "kkkkkkkkkkkk",
      "...k....k...",
      "..kk....kk..",
    ],
    pal: { k: INK, R: "#D9302A", W: "#F4F2EC", G: "#C9C6BD" },
  },
  // 야식 슬라임: 주황 슬라임, 반짝이는 눈, 젓가락 하나
  MIDNIGHT_SNACK: {
    rows: [
      "..........k.",
      ".........kYk",
      "....kkkk.kYk",
      "..kkOOOOkkk.",
      ".kOOOOOOOOk.",
      ".kOwkOOwkOk.",
      "kOOkkOOkkOOk",
      "kOOOOOOOOOOk",
      "kOOOkkkkOOOk",
      "kOOOOOOOOOOk",
      "kDOOOOOOOODk",
      ".kkkkkkkkkk.",
    ],
    pal: { k: INK, O: "#F08A2E", D: "#C4661C", w: "#FFFFFF", Y: "#F0BE2E" },
  },
  // 알람 스누즈: 노란 종 두 개 자명종, 감긴 눈 "z"
  SNOOZE: {
    rows: [
      ".kk......kk.",
      "kYYk....kYYk",
      "kYYkkkkkkYYk",
      ".kkSSSSSSkk.",
      "kSSWWWWWWSSk",
      "kSWWWWWWWWSk",
      "kSWkkWWkkWSk",
      "kSWWWWWWWWSk",
      "kSWWWkkWWWSk",
      "kSWWWWWWWWSk",
      ".kSSSSSSSSk.",
      "..kkkkkkkk..",
      "..kk....kk..",
    ],
    pal: { k: INK, Y: "#F0BE2E", S: "#9A9DA3", W: "#F4F2EC" },
  },
  // 핑계: 말풍선 모양 유령, 꼬리가 아래로
  EXCUSE: {
    rows: [
      "..kkkkkkkk..",
      ".kBBBBBBBBk.",
      "kBBBBBBBBBBk",
      "kBBkkBBkkBBk",
      "kBBBBBBBBBBk",
      "kBBBkkkkBBBk",
      "kBBBBBBBBBBk",
      ".kBBBBBBBBk.",
      "..kkkBBkkk..",
      "....kBBk....",
      ".....kBk....",
      "......k.....",
    ],
    pal: { k: INK, B: "#B9C6DE" },
  },
  // 소파 괴물(희귀): 갈색 소파 등받이에 빨간 눈
  SOFA: {
    rows: [
      ".kkkkkkkkkkkk.",
      "kMMMMMMMMMMMMk",
      "kMMrrMMMMrrMMk",
      "kMMMMMMMMMMMMk",
      "kMMMMkkkkMMMMk",
      "kkkkkkkkkkkkkk",
      "kMkLLLLLLLLkMk",
      "kMkLLLLLLLLkMk",
      "kkkkkkkkkkkkkk",
      ".kk........kk.",
    ],
    pal: { k: INK, M: "#7A4A2E", L: "#A86A44", r: "#D9302A" },
  },
};

/** 쓰러진 잡몹: 회색 팔레트 */
const DOWN = (c: string) => (c === INK ? "#3C3E44" : "#5B5E66");

export function mobArt(code: string): MobArt {
  return MOB_ART[code] ?? MOB_ART.TOMORROW;
}

export function artSize(code: string) {
  const a = mobArt(code);
  return { w: a.rows[0].length, h: a.rows.length };
}

/** 캔버스에 그린다(x · y = 왼쪽 위, 1칸 = 1픽셀) */
export function drawMob(g: CanvasRenderingContext2D, code: string, x: number, y: number, down = false) {
  const a = mobArt(code);
  a.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      const color = a.pal[ch] ?? INK;
      g.fillStyle = down ? DOWN(color) : color;
      g.fillRect(x + i, y + j, 1, 1);
    }
  });
}
