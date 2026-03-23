export type ShareCardTheme = "sunset" | "mint" | "midnight";
export type ShareCardRatio = "feed" | "square" | "story";
export type ShareCardQuoteStyle = "glass" | "outline" | "solid";
export type ShareCardMediaFit = "cover" | "contain";
export type ShareCardCharacter = "none" | "me" | "deukgeun";
export type ShareCardCharacterPose = "flex" | "wave" | "heart" | "victory" | "fire" | "squat" | "jump" | "run";

type ShareCardInput = {
  date: string;
  didWorkout: boolean;
  workoutTypes: string[];
  workoutIntensity?: string | null;
  memo?: string | null;
  shareComment?: string | null;
  mediaUrl?: string | null;
  nickname?: string | null;
  theme?: ShareCardTheme;
  ratio?: ShareCardRatio;
  quoteStyle?: ShareCardQuoteStyle;
  sticker?: string;
  showMeta?: boolean;
  cheerCount?: number;
  mediaFit?: ShareCardMediaFit;
  mediaPositionX?: number;
  mediaPositionY?: number;
  character?: ShareCardCharacter;
  characterPose?: ShareCardCharacterPose;
  characterLabel?: string | null;
  characterSize?: number;
  watermarkText?: string;
  scale?: number;
};

const THEME_GRADIENTS: Record<ShareCardTheme, [string, string, string]> = {
  sunset: ["#1d1234", "#5a2a67", "#ff8846"],
  mint: ["#062521", "#0f5f56", "#2cd5aa"],
  midnight: ["#080d1f", "#1a2f5f", "#5f86ff"],
};

const RATIO_SIZE: Record<ShareCardRatio, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

const POSE_TEXT: Record<ShareCardCharacterPose, string> = {
  flex: "FLEX",
  wave: "WAVE",
  heart: "HEART",
  victory: "V",
  fire: "FIRE",
  squat: "SQUAT",
  jump: "JUMP",
  run: "RUN",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number) {
  ctx.font = `700 ${fontSize}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
  const paddingX = Math.round(fontSize * 0.75);
  const h = Math.round(fontSize * 1.9);
  const w = Math.ceil(ctx.measureText(text).width) + paddingX * 2;
  drawRoundedRect(ctx, x, y, w, h, Math.round(h / 2));
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + paddingX, y + h / 2);
  return w;
}

function drawQuoteBox(
  ctx: CanvasRenderingContext2D,
  style: ShareCardQuoteStyle,
  x: number,
  y: number,
  w: number,
  h: number
) {
  drawRoundedRect(ctx, x, y, w, h, 30);
  if (style === "glass") {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
  } else if (style === "outline") {
    ctx.fillStyle = "rgba(4,8,20,0.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fill();
  }
}

function drawDeukgeunAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pose: ShareCardCharacterPose) {
  const half = size / 2;

  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, Math.round(size * 0.33));
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fill();

  const cx = x + half;
  const cy = y + half;
  const face = size * 0.34;

  ctx.beginPath();
  ctx.arc(cx, cy, face, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe29a";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - face * 0.7, cy - face * 0.7, face * 0.28, 0, Math.PI * 2);
  ctx.arc(cx + face * 0.7, cy - face * 0.7, face * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd66f";
  ctx.fill();

  ctx.fillStyle = "#3c2d0f";
  ctx.beginPath();
  ctx.arc(cx - face * 0.35, cy - face * 0.1, face * 0.08, 0, Math.PI * 2);
  ctx.arc(cx + face * 0.35, cy - face * 0.1, face * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3c2d0f";
  ctx.lineWidth = Math.max(2, Math.round(size * 0.02));
  ctx.beginPath();
  ctx.arc(cx, cy + face * 0.08, face * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.round(size * 0.18)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(POSE_TEXT[pose], x + size / 2, y + size - 8);
  ctx.restore();
}

function drawCharacterBadge(
  ctx: CanvasRenderingContext2D,
  input: ShareCardInput,
  width: number,
  height: number,
  horizontalPad: number
) {
  const character = input.character ?? "none";
  if (character === "none") return;

  const pose = input.characterPose ?? "flex";
  const label = (input.characterLabel || (character === "deukgeun" ? "Deukgeun" : "My Character")).trim();
  const characterSize = clamp(input.characterSize ?? 1, 0.65, 1.8);
  const boxW = Math.round(width * 0.34 * characterSize);
  const boxH = Math.round(height * 0.108 * characterSize);
  const boxX = width - horizontalPad - boxW;
  const boxY = Math.round(height * 0.74);

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 22);
  ctx.fillStyle = "rgba(7, 12, 28, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const avatarSize = Math.round(boxH * 0.72);
  const avatarX = boxX + 14;
  const avatarY = boxY + Math.round((boxH - avatarSize) / 2);

  if (character === "deukgeun") {
    drawDeukgeunAvatar(ctx, avatarX, avatarY, avatarSize, pose);
  } else {
    drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, Math.round(avatarSize * 0.32));
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fill();
    const initial = (input.nickname?.trim()?.[0] ?? "M").toUpperCase();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.round(avatarSize * 0.46)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1);

    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.round(avatarSize * 0.18)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(POSE_TEXT[pose], avatarX + avatarSize / 2, avatarY + avatarSize - 5);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `700 ${Math.round(width * 0.023)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
  ctx.fillText(label, avatarX + avatarSize + 12, boxY + Math.round(boxH * 0.5));
  ctx.font = `500 ${Math.round(width * 0.019)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.fillText(`Pose ${POSE_TEXT[pose]}`, avatarX + avatarSize + 12, boxY + Math.round(boxH * 0.77));
}

function renderCardCanvas(input: ShareCardInput): Promise<HTMLCanvasElement> {
  return new Promise(async (resolve, reject) => {
    try {
      const ratio = input.ratio ?? "feed";
      const { width, height } = RATIO_SIZE[ratio];
      const theme = input.theme ?? "sunset";
      const quoteStyle = input.quoteStyle ?? "glass";
      const showMeta = input.showMeta ?? true;
      const scale = Math.max(1, Math.min(3, Math.round(input.scale ?? 1)));
      const mediaFit = input.mediaFit ?? "cover";
      const mediaPosX = clamp(input.mediaPositionX ?? 50, 0, 100);
      const mediaPosY = clamp(input.mediaPositionY ?? 50, 0, 100);
      const watermarkText = (input.watermarkText || "DEUKGEUN").trim() || "DEUKGEUN";

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context is unavailable.");
      ctx.scale(scale, scale);

      const [c1, c2, c3] = THEME_GRADIENTS[theme];
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, c1);
      gradient.addColorStop(0.55, c2);
      gradient.addColorStop(1, c3);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const horizontalPad = Math.round(width * 0.067);
      const mediaTop = Math.round(height * 0.12);
      const mediaWidth = width - horizontalPad * 2;
      const mediaHeight = ratio === "story" ? Math.round(height * 0.36) : Math.round(height * 0.37);

      if (input.mediaUrl) {
        try {
          const img = await loadImage(input.mediaUrl);
          drawRoundedRect(ctx, horizontalPad, mediaTop, mediaWidth, mediaHeight, 36);
          ctx.save();
          ctx.clip();

          if (mediaFit === "contain") {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(horizontalPad, mediaTop, mediaWidth, mediaHeight);
            const ratioValue = Math.min(mediaWidth / img.width, mediaHeight / img.height);
            const drawW = img.width * ratioValue;
            const drawH = img.height * ratioValue;
            const drawX = horizontalPad + (mediaWidth - drawW) / 2;
            const drawY = mediaTop + (mediaHeight - drawH) / 2;
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          } else {
            const ratioValue = Math.max(mediaWidth / img.width, mediaHeight / img.height);
            const drawW = img.width * ratioValue;
            const drawH = img.height * ratioValue;
            const overflowX = Math.max(0, drawW - mediaWidth);
            const overflowY = Math.max(0, drawH - mediaHeight);
            const drawX = horizontalPad - overflowX * (mediaPosX / 100);
            const drawY = mediaTop - overflowY * (mediaPosY / 100);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
          ctx.restore();

          const overlay = ctx.createLinearGradient(0, mediaTop + mediaHeight - 200, 0, mediaTop + mediaHeight);
          overlay.addColorStop(0, "rgba(0,0,0,0)");
          overlay.addColorStop(1, "rgba(0,0,0,0.6)");
          ctx.fillStyle = overlay;
          drawRoundedRect(ctx, horizontalPad, mediaTop, mediaWidth, mediaHeight, 36);
          ctx.fill();
        } catch {
          // Ignore image failures and continue with gradient-only card.
        }
      }

      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `700 ${Math.round(width * 0.033)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(watermarkText, horizontalPad, Math.round(height * 0.07));

      if (input.sticker?.trim()) {
        ctx.font = `${Math.round(width * 0.07)}px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
        ctx.fillText(input.sticker, width - horizontalPad - 70, Math.round(height * 0.078));
      }

      const headingY = mediaTop + mediaHeight + Math.round(height * 0.09);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${Math.round(width * 0.06)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
      const heading = input.didWorkout ? "Workout Complete" : "Recovery Day";
      ctx.fillText(heading, horizontalPad, headingY);

      ctx.font = `500 ${Math.round(width * 0.031)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const owner = input.nickname?.trim() ? `${input.nickname}'s Log` : "My Daily Log";
      ctx.fillText(`${owner}  ${input.date}`, horizontalPad, headingY + Math.round(height * 0.04));

      let tagX = horizontalPad;
      const tagY = headingY + Math.round(height * 0.065);
      const tagFont = Math.round(width * 0.022);
      for (const tag of input.workoutTypes.slice(0, 3)) {
        const w = drawTag(ctx, tag, tagX, tagY, tagFont);
        tagX += w + 12;
      }
      if (input.workoutIntensity) {
        drawTag(ctx, `intensity: ${input.workoutIntensity}`, tagX, tagY, tagFont);
      }

      const quoteText = (input.shareComment || input.memo || "").trim() || "One more day checked in.";
      const quoteTop = tagY + Math.round(height * 0.075);
      const quoteHeight = ratio === "story" ? Math.round(height * 0.21) : Math.round(height * 0.17);
      drawQuoteBox(ctx, quoteStyle, horizontalPad, quoteTop, mediaWidth, quoteHeight);

      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(width * 0.038)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
      const quoteLines = wrapText(ctx, quoteText, mediaWidth - 70).slice(0, ratio === "story" ? 5 : 4);
      quoteLines.forEach((line, idx) => {
        ctx.fillText(line, horizontalPad + 34, quoteTop + 60 + idx * Math.round(height * 0.04));
      });

      drawCharacterBadge(ctx, input, width, height, horizontalPad);

      if (showMeta) {
        const metaY = quoteTop + quoteHeight + Math.round(height * 0.05);
        drawRoundedRect(ctx, horizontalPad, metaY, mediaWidth, Math.round(height * 0.07), 20);
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `600 ${Math.round(width * 0.028)}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
        const cheer = input.cheerCount ?? 0;
        ctx.fillText(`Cheers ${cheer}  -  Shared via DEUKGEUN`, horizontalPad + 28, metaY + Math.round(height * 0.045));
      }

      resolve(canvas);
    } catch (e) {
      reject(e);
    }
  });
}

export async function renderAttendanceShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = await renderCardCanvas(input);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate image blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function renderAttendanceShareCardPreviewDataUrl(
  input: ShareCardInput,
  previewWidth = 320
): Promise<string> {
  const canvas = await renderCardCanvas({ ...input, scale: 1 });
  const ratio = canvas.height / canvas.width;
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = previewWidth;
  previewCanvas.height = Math.round(previewWidth * ratio);
  const ctx = previewCanvas.getContext("2d");
  if (!ctx) throw new Error("Preview context is unavailable.");
  ctx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  return previewCanvas.toDataURL("image/png");
}
