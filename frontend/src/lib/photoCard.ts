// 사진 공유 카드(나이키 런클럽처럼) — 러닝 · 출석 공유가 같이 쓴다.
// 사진(또는 단색) 위에 작은 워터마크(왼쪽 위) 하나와 고른 숫자만 얹는다. 꾸밈 상자 · 스티커 · 장식 없음.
// html2canvas 를 쓰지 않고 캔버스에 직접 그린다(필터 · 크기 깨짐 없음, CLAUDE.md "html2canvas" 함정).
// 저장 크기: 스토리 1080×1920 · 게시물 1080×1350.
import type { LatLng } from "./running";

export type ShareRatio = "story" | "post";

/** 카드에 얹을 내용(위에서 아래로): 윗줄(날짜 등) · 한마디 · 큰 숫자 · 작은 숫자 줄 · 코스 */
export type PhotoCardContent = {
  kicker?: string | null;
  quote?: string | null;
  headline?: { value: string; label: string } | null;
  stats?: { value: string; label: string }[];
  route?: LatLng[] | null;
};

export type PhotoCardStyle = {
  ratio: ShareRatio;
  /** 숫자 묶음 위치(워터마크는 늘 왼쪽 위) */
  place: "bottom" | "top";
  ink: "light" | "dark";
  /** 사진을 조금 어둡게(밝게) — 글자가 잘 보이게 */
  dim: boolean;
  photo: HTMLImageElement | null;
  /** 사진 위치(-1 ~ 1, 0 이 가운데) */
  pan: { x: number; y: number };
};

export const CARD_W = 1080;
export const cardHeight = (r: ShareRatio) => (r === "story" ? 1920 : 1350);

const NUM = '"Big Shoulders Display", "IBM Plex Sans KR", sans-serif';
const DISPLAY = '"Black Han Sans", "IBM Plex Sans KR", sans-serif';
const BODY = '"IBM Plex Sans KR", sans-serif';
const RED = "#D9302A";
const PAD = 72;

/** 캔버스에 쓰기 전에 글꼴을 받아 둔다(안 받으면 기본 글꼴로 그려짐) */
export async function loadCardFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`900 100px ${NUM}`),
    document.fonts.load(`800 100px ${NUM}`),
    document.fonts.load(`400 40px ${DISPLAY}`, "득근"),
    document.fonts.load(`600 30px ${BODY}`, "평균 페이스"),
    document.fonts.load(`700 30px ${BODY}`, "오늘 운동"),
  ]).catch(() => undefined);
}

/** 사진을 칸에 꽉 채우고(cover) pan 만큼 옮긴다 */
export function coverRect(iw: number, ih: number, W: number, H: number, pan: { x: number; y: number }) {
  const s = Math.max(W / iw, H / ih);
  const dw = iw * s;
  const dh = ih * s;
  const ox = dw - W;
  const oy = dh - H;
  return { x: (-ox / 2) * (1 + pan.x), y: (-oy / 2) * (1 + pan.y), w: dw, h: dh, overflowX: ox, overflowY: oy };
}

function drawWatermark(g: CanvasRenderingContext2D, color: string) {
  const cx = PAD + 24;
  const cy = PAD + 24;
  // 원판 모양 로고(빨간 원판 + 가운데 구멍) — 앱 상단 로고와 같은 모양
  g.fillStyle = RED;
  g.beginPath();
  g.arc(cx, cy, 24, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, 15, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#E8E6E0";
  g.beginPath();
  g.arc(cx, cy, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.font = `40px ${DISPLAY}`;
  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillText("득근득근", cx + 40, cy + 2);
}

function drawRoute(g: CanvasRenderingContext2D, route: LatLng[], box: { x: number; y: number; size: number }, color: string) {
  const lat0 = route[0][0];
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pts = route.map(([lat, lng]) => [lng * k, -lat] as const);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1e-9);
  const h = Math.max(Math.max(...ys) - minY, 1e-9);
  const scale = box.size / Math.max(w, h);
  const offX = box.x + (box.size - w * scale) / 2;
  const offY = box.y + (box.size - h * scale) / 2;
  const xy = pts.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY] as const);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 12;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  xy.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // 출발(초록) · 도착(빨강)
  const dot = (x: number, y: number, c: string) => {
    g.shadowColor = "transparent";
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, 14, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = color;
    g.stroke();
  };
  dot(xy[0][0], xy[0][1], "#2E9C55");
  dot(xy[xy.length - 1][0], xy[xy.length - 1][1], RED);
  g.restore();
}

/** 한 줄 폭을 넘으면 글자 단위로 줄을 나눈다(최대 lines 줄, 넘치면 …) */
function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number, lines: number) {
  const out: string[] = [];
  let cur = "";
  for (const ch of text.replace(/\s+/g, " ").trim()) {
    if (g.measureText(cur + ch).width > maxW && cur) {
      out.push(cur);
      cur = ch.trimStart();
      if (out.length === lines) break;
    } else cur += ch;
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && out.join("").length < text.replace(/\s+/g, " ").trim().length) {
    let last = out[lines - 1];
    while (last && g.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    out[lines - 1] = last + "…";
  }
  return out;
}

/** 카드 한 장을 그린다. g 의 캔버스는 CARD_W × cardHeight(ratio) */
export function drawPhotoCard(g: CanvasRenderingContext2D, c: PhotoCardContent, o: PhotoCardStyle) {
  const W = CARD_W;
  const H = cardHeight(o.ratio);
  g.clearRect(0, 0, W, H);

  // 바탕: 사진(꽉 채움) 또는 단색
  if (o.photo) {
    const r = coverRect(o.photo.naturalWidth, o.photo.naturalHeight, W, H, o.pan);
    g.drawImage(o.photo, r.x, r.y, r.w, r.h);
    if (o.dim) {
      g.fillStyle = o.ink === "light" ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.3)";
      g.fillRect(0, 0, W, H);
    }
  } else {
    g.fillStyle = o.ink === "light" ? "#17181B" : "#EEECE6";
    g.fillRect(0, 0, W, H);
  }

  const color = o.ink === "light" ? "#FFFFFF" : "#111214";
  const soft = o.ink === "light" ? "rgba(255,255,255,0.8)" : "rgba(17,18,20,0.72)";
  // 사진 위 흰 글자는 옅은 그림자(사진이 밝아도 읽히게)
  const shadow = () => {
    if (o.photo && o.ink === "light") {
      g.shadowColor = "rgba(0,0,0,0.35)";
      g.shadowBlur = 18;
      g.shadowOffsetY = 2;
    } else {
      g.shadowColor = "transparent";
    }
  };
  shadow();
  drawWatermark(g, color);

  // 숫자 묶음 높이를 먼저 계산
  const big = o.ratio === "story" ? 300 : 250;
  const parts: { h: number; draw: (top: number) => void }[] = [];
  if (c.kicker) {
    const kicker = c.kicker;
    parts.push({
      h: 56,
      draw: (top) => {
        g.font = `600 34px ${BODY}`;
        g.fillStyle = soft;
        g.textBaseline = "top";
        g.textAlign = "left";
        g.fillText(kicker, PAD, top);
      },
    });
  }
  if (c.quote) {
    g.font = `700 48px ${BODY}`;
    const lines = wrapText(g, c.quote, W - PAD * 2, 2);
    parts.push({
      h: lines.length * 64,
      draw: (top) => {
        g.font = `700 48px ${BODY}`;
        g.fillStyle = color;
        g.textBaseline = "top";
        g.textAlign = "left";
        lines.forEach((line, i) => g.fillText(line, PAD, top + i * 64));
      },
    });
  }
  if (c.headline) {
    const head = c.headline;
    parts.push({
      h: big * 0.82 + 70,
      draw: (top) => {
        g.textBaseline = "alphabetic";
        g.textAlign = "left";
        g.fillStyle = color;
        g.font = `900 ${big}px ${NUM}`;
        const base = top + big * 0.78;
        g.fillText(head.value, PAD - 6, base);
        g.font = `600 36px ${BODY}`;
        g.fillStyle = soft;
        g.textBaseline = "top";
        g.fillText(head.label, PAD, base + 18);
      },
    });
  }
  const stats = c.stats ?? [];
  if (stats.length) {
    parts.push({
      h: 140,
      draw: (top) => {
        let x = PAD;
        stats.forEach((st) => {
          g.textAlign = "left";
          g.textBaseline = "top";
          // 숫자가 아닌 값(웨이트 · 유산소)은 한글 굵은 글꼴로
          const numeric = /^[\d'":.,\s/-]+$/.test(st.value);
          g.font = numeric ? `800 88px ${NUM}` : `700 56px ${BODY}`;
          g.fillStyle = color;
          g.fillText(st.value, x, top + (numeric ? 0 : 20));
          const w = g.measureText(st.value).width;
          g.font = `600 30px ${BODY}`;
          g.fillStyle = soft;
          g.fillText(st.label, x, top + 96);
          // 다음 칸은 360px 간격, 값이 길면 그만큼 밀어서 겹치지 않게
          x += Math.max(360, w + 72);
        });
      },
    });
  }
  const gap = 24;
  const blockH = parts.reduce((a, p) => a + p.h, 0) + gap * Math.max(0, parts.length - 1);
  const watermarkBottom = PAD + 48;
  const blockTop = o.place === "bottom" ? H - PAD - 16 - blockH : watermarkBottom + 56;
  let y = blockTop;
  for (const p of parts) {
    p.draw(y);
    y += p.h + gap;
  }

  // 코스: 숫자 묶음과 겹치지 않는 남은 칸 가운데. 사진이 주인공이 되게 너무 크지 않게(스토리 520 · 게시물 400)
  if (c.route && c.route.length > 1) {
    const free = o.place === "bottom" ? { top: watermarkBottom + 40, bottom: blockTop - 48 } : { top: blockTop + blockH + 48, bottom: H - PAD };
    const size = Math.min(o.ratio === "story" ? 520 : 400, free.bottom - free.top);
    if (size > 160) {
      shadow();
      drawRoute(g, c.route, { x: (W - size) / 2, y: free.top + (free.bottom - free.top - size) / 2, size }, color);
    }
  }
  g.shadowColor = "transparent";
}

/** 2026.10.16 */
export function dotDate(value: string | number) {
  const d = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 공유 파일 이름: dukgeun-run-20261016.jpg */
export function shareFileName(kind: string, value: string | number) {
  const day = dotDate(value).replaceAll(".", "") || kind;
  return `dukgeun-${kind}-${day}.jpg`;
}
