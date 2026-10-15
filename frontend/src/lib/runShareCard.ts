// 러닝 공유 카드(나이키 런클럽처럼) — 사진 위에 거리 · 페이스 · 시간 · 달린 코스와 작은 워터마크(왼쪽 위) 하나만 얹는다.
// html2canvas 를 쓰지 않고 캔버스에 직접 그린다(필터 · 크기 깨짐 없음, CLAUDE.md "html2canvas" 함정).
// 저장 크기: 스토리 1080×1920 · 게시물 1080×1350.
import { formatKm, formatPace, type LatLng } from "./running";
import { formatClock } from "./workoutSession";

export type ShareRatio = "story" | "post";

export type RunShareData = {
  distanceM: number;
  durationSec: number;
  paceSec: number | null;
  /** 시작 시각(ISO 또는 ms) */
  startedAt: string | number;
  route: LatLng[] | null;
};

export type RunShareOptions = {
  ratio: ShareRatio;
  show: { distance: boolean; pace: boolean; time: boolean; route: boolean; date: boolean };
  /** 숫자 묶음 위치(워터마크는 늘 왼쪽 위) */
  place: "bottom" | "top";
  ink: "light" | "dark";
  /** 사진을 조금 어둡게(글자가 잘 보이게) */
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
    document.fonts.load(`700 100px ${NUM}`),
    document.fonts.load(`400 40px ${DISPLAY}`, "득근"),
    document.fonts.load(`600 30px ${BODY}`, "평균 페이스"),
  ]).catch(() => undefined);
}

function dateLabel(startedAt: string | number) {
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const part = h < 5 ? "새벽" : h < 11 ? "아침" : h < 16 ? "낮" : h < 20 ? "저녁" : "밤";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${part} 러닝`;
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
  // 원판 모양 로고(빨간 원판 + 가운데 구멍)
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

/** 카드 한 장을 그린다. g 의 캔버스는 CARD_W × cardHeight(ratio) */
export function drawRunCard(g: CanvasRenderingContext2D, data: RunShareData, o: RunShareOptions) {
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
  const soft = o.ink === "light" ? "rgba(255,255,255,0.78)" : "rgba(17,18,20,0.72)";
  // 사진 위 흰 글자는 살짝 그림자(사진이 밝아도 읽히게)
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
  const s = o.show;
  const rowStats = [
    s.pace ? { label: "평균 페이스", value: formatPace(data.paceSec) } : null,
    s.time ? { label: "시간", value: formatClock(data.durationSec) } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  const big = o.ratio === "story" ? 300 : 250;
  const parts: { h: number; draw: (top: number) => void }[] = [];
  if (s.date) {
    parts.push({
      h: 56,
      draw: (top) => {
        g.font = `600 34px ${BODY}`;
        g.fillStyle = soft;
        g.textBaseline = "top";
        g.textAlign = "left";
        g.fillText(dateLabel(data.startedAt), PAD, top);
      },
    });
  }
  if (s.distance) {
    parts.push({
      h: big * 0.82 + 70,
      draw: (top) => {
        g.textBaseline = "alphabetic";
        g.textAlign = "left";
        g.fillStyle = color;
        g.font = `900 ${big}px ${NUM}`;
        const base = top + big * 0.78;
        const km = formatKm(data.distanceM);
        g.fillText(km, PAD - 6, base);
        g.font = `600 36px ${BODY}`;
        g.fillStyle = soft;
        g.textBaseline = "top";
        g.fillText("킬로미터", PAD, base + 18);
      },
    });
  }
  if (rowStats.length) {
    parts.push({
      h: 140,
      draw: (top) => {
        rowStats.forEach((st, i) => {
          const x = PAD + i * 360;
          g.textAlign = "left";
          g.textBaseline = "top";
          g.font = `800 88px ${NUM}`;
          g.fillStyle = color;
          g.fillText(st.value, x, top);
          g.font = `600 30px ${BODY}`;
          g.fillStyle = soft;
          g.fillText(st.label, x, top + 96);
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

  // 코스: 숫자 묶음과 겹치지 않는 남은 칸 가운데
  if (s.route && data.route && data.route.length > 1) {
    const free = o.place === "bottom" ? { top: watermarkBottom + 40, bottom: blockTop - 48 } : { top: blockTop + blockH + 48, bottom: H - PAD };
    // 사진이 주인공이 되게 코스는 너무 크지 않게(스토리 520 · 게시물 400)
    const size = Math.min(o.ratio === "story" ? 520 : 400, free.bottom - free.top);
    if (size > 160) {
      g.shadowColor = "transparent";
      shadow();
      drawRoute(g, data.route, { x: (W - size) / 2, y: free.top + (free.bottom - free.top - size) / 2, size }, color);
    }
  }
  g.shadowColor = "transparent";
}

/** 공유 파일 이름: dukgeun-run-20261016.jpg */
export function runShareFileName(startedAt: string | number) {
  const d = new Date(startedAt);
  const day = Number.isNaN(d.getTime())
    ? "run"
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `dukgeun-run-${day}.jpg`;
}
