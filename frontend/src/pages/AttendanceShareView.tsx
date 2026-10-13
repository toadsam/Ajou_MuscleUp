import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import { defaultGrowthParams, type GrowthParams } from "../components/avatar/types";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  renderAttendanceShareCard,
  type ShareCardCharacter,
  type ShareCardCharacterPose,
  type ShareCardMediaFit,
  renderAttendanceShareCardPreviewDataUrl,
  type ShareCardQuoteStyle,
  type ShareCardRatio,
  type ShareCardTheme,
} from "../utils/attendanceShareCard";
import "../styles/attendanceShare.css";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";

// 공개 공유 응답. 백엔드가 공개 응답에서 memo·reportCount·hiddenByAdmin·id 를 뺄 수 있어 모두 선택 값으로 둔다.
type ShareData = {
  id?: number;
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
  mediaUrls?: string[] | null;
  authorNickname?: string | null;
  cheerCount?: number | null;
  reportCount?: number | null;
  hiddenByAdmin?: boolean | null;
  currentStreak?: number | null;
  lastEditedAt?: string | null;
  updatedAt?: string | null;
  shareSlug: string;
};
type MyCharacterProfile = {
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";
  evolutionStage: number;
  title: string;
  gender?: "MALE" | "FEMALE" | null;
  avatarSeed: string;
  stylePreset: string;
  growthParams?: GrowthParams | null;
};

type CharacterExpression = "smile" | "proud" | "serious" | "surprised";
type TextFontPreset = "comic" | "retro" | "gym" | "clean" | "cute";
type TextDecorPreset = "plain" | "gradient" | "outline" | "shadow";
type ThemePackId = "cute" | "retro" | "gym" | "comic";
type DecoType = "star" | "heart" | "bolt" | "tape" | "mychar" | "deukgeun";

type DecoItem = {
  id: string;
  type: DecoType;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
};

type SectionKey =
  | "preset"
  | "themePack"
  | "advancedCard"
  | "text"
  | "photo"
  | "character"
  | "deco"
  | "message";

type SharePreset = {
  theme: ShareCardTheme;
  ratio: ShareCardRatio;
  quoteStyle: ShareCardQuoteStyle;
  sticker: string;
  showMeta: boolean;
  mediaFit: ShareCardMediaFit;
  mediaPositionX: number;
  mediaPositionY: number;
  character: ShareCardCharacter;
  characterPose: ShareCardCharacterPose;
  characterExpression: CharacterExpression;
  characterSize: number;
  textFont: TextFontPreset;
  textDecor: TextDecorPreset;
  showTitle: boolean;
  showSubtitle: boolean;
  exportScale: 1 | 2 | 3 | 4;
};

type ReactionStore = Record<string, { cheer?: boolean; report?: boolean }>;

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const PRESET_KEY = "attendance_share_preset_v1";
const REACTION_KEY = "attendance_share_reaction_v1";

const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const withProxy = (url: string) => `${API_BASE}/api/files/proxy?path=${encodeURIComponent(url)}`;
const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url.split("?")[0]);

const THEME_OPTIONS: Array<{ id: ShareCardTheme; label: string }> = [
  { id: "sunset", label: "노을" },
  { id: "mint", label: "민트" },
  { id: "midnight", label: "한밤" },
];

const RATIO_OPTIONS: Array<{ id: ShareCardRatio; label: string }> = [
  { id: "feed", label: "피드 4:5" },
  { id: "square", label: "정사각 1:1" },
  { id: "story", label: "스토리 9:16" },
];

const QUOTE_OPTIONS: Array<{ id: ShareCardQuoteStyle; label: string }> = [
  { id: "glass", label: "반투명" },
  { id: "outline", label: "테두리" },
  { id: "solid", label: "단색" },
];

const MEDIA_FIT_OPTIONS: Array<{ id: ShareCardMediaFit; label: string }> = [
  { id: "cover", label: "꽉 채우기" },
  { id: "contain", label: "비율 맞추기" },
];

const CHARACTER_OPTIONS: Array<{ id: ShareCardCharacter; label: string }> = [
  { id: "none", label: "없음" },
  { id: "me", label: "내 캐릭터" },
  { id: "deukgeun", label: "득근이" },
];

const CHARACTER_POSE_OPTIONS: Array<{ id: ShareCardCharacterPose; label: string }> = [
  { id: "flex", label: "근육" },
  { id: "wave", label: "인사" },
  { id: "heart", label: "하트" },
  { id: "victory", label: "브이" },
  { id: "fire", label: "파워" },
  { id: "squat", label: "스쿼트" },
  { id: "jump", label: "점프" },
  { id: "run", label: "러닝" },
];

const CHARACTER_EXPRESSION_OPTIONS: Array<{ id: CharacterExpression; label: string }> = [
  { id: "smile", label: "웃음" },
  { id: "proud", label: "뿌듯" },
  { id: "serious", label: "진지" },
  { id: "surprised", label: "놀람" },
];

const TEXT_FONT_OPTIONS: Array<{ id: TextFontPreset; label: string }> = [
  { id: "comic", label: "만화" },
  { id: "cute", label: "귀여움" },
  { id: "retro", label: "레트로" },
  { id: "gym", label: "포스터" },
  { id: "clean", label: "클린" },
];

const TEXT_DECOR_OPTIONS: Array<{ id: TextDecorPreset; label: string }> = [
  { id: "plain", label: "기본" },
  { id: "gradient", label: "그라데이션" },
  { id: "outline", label: "외곽선" },
  { id: "shadow", label: "그림자" },
];

const DECO_GLYPH: Record<DecoType, string> = {
  star: "★",
  heart: "❤",
  bolt: "⚡",
  tape: "▭",
  mychar: "ME",
  deukgeun: "DG",
};

const THEME_PACKS: Array<{
  id: ThemePackId;
  label: string;
  theme: ShareCardTheme;
  quoteStyle: ShareCardQuoteStyle;
  sticker: string;
  textFont: TextFontPreset;
  textDecor: TextDecorPreset;
  defaultDecos: Array<Pick<DecoItem, "type" | "x" | "y" | "size" | "rotation" | "opacity">>;
}> = [
  {
    id: "cute",
    label: "귀여움",
    theme: "mint",
    quoteStyle: "glass",
    sticker: "✨",
    textFont: "cute",
    textDecor: "gradient",
    defaultDecos: [
      { type: "heart", x: 18, y: 18, size: 1.1, rotation: -12, opacity: 0.85 },
      { type: "star", x: 84, y: 22, size: 0.9, rotation: 8, opacity: 0.92 },
    ],
  },
  {
    id: "retro",
    label: "레트로",
    theme: "sunset",
    quoteStyle: "outline",
    sticker: "🎞️",
    textFont: "retro",
    textDecor: "outline",
    defaultDecos: [
      { type: "tape", x: 14, y: 14, size: 1.15, rotation: -22, opacity: 0.76 },
      { type: "tape", x: 87, y: 82, size: 1.15, rotation: 18, opacity: 0.76 },
    ],
  },
  {
    id: "gym",
    label: "헬스장 포스터",
    theme: "midnight",
    quoteStyle: "solid",
    sticker: "💪",
    textFont: "gym",
    textDecor: "shadow",
    defaultDecos: [
      { type: "bolt", x: 15, y: 20, size: 1.2, rotation: -6, opacity: 0.94 },
      { type: "star", x: 86, y: 18, size: 1.05, rotation: 10, opacity: 0.8 },
    ],
  },
  {
    id: "comic",
    label: "만화풍",
    theme: "sunset",
    quoteStyle: "outline",
    sticker: "💥",
    textFont: "comic",
    textDecor: "outline",
    defaultDecos: [
      { type: "star", x: 12, y: 76, size: 1.25, rotation: -14, opacity: 0.88 },
      { type: "bolt", x: 86, y: 16, size: 1.12, rotation: 14, opacity: 0.88 },
    ],
  },
];

// 카드에 붙이는 스티커(카드 내용물). 커밋 2de4f34 에서 "??" 로 깨졌던 것을 그 직전 커밋 값으로 되살렸다.
const STICKERS = ["", "🔥", "💪", "✨", "🚀", "🏆", "⚡", "🎯"];

const DEFAULT_PRESET: SharePreset = {
  theme: "sunset",
  ratio: "feed",
  quoteStyle: "glass",
  sticker: "",
  showMeta: false,
  mediaFit: "cover",
  mediaPositionX: 50,
  mediaPositionY: 50,
  character: "none",
  characterPose: "flex",
  characterExpression: "smile",
  characterSize: 1,
  textFont: "comic",
  textDecor: "gradient",
  showTitle: false,
  showSubtitle: false,
  exportScale: 4,
};

function loadPreset(): SharePreset {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return DEFAULT_PRESET;
    const parsed = JSON.parse(raw) as Partial<SharePreset>;
    return {
      theme: parsed.theme ?? DEFAULT_PRESET.theme,
      ratio: parsed.ratio ?? DEFAULT_PRESET.ratio,
      quoteStyle: parsed.quoteStyle ?? DEFAULT_PRESET.quoteStyle,
      // 깨진 "??" 가 저장된 예전 프리셋은 스티커 없음으로 되돌린다
      sticker: parsed.sticker && !parsed.sticker.includes("?") ? parsed.sticker : DEFAULT_PRESET.sticker,
      showMeta: parsed.showMeta ?? DEFAULT_PRESET.showMeta,
      mediaFit: parsed.mediaFit ?? DEFAULT_PRESET.mediaFit,
      mediaPositionX: parsed.mediaPositionX ?? DEFAULT_PRESET.mediaPositionX,
      mediaPositionY: parsed.mediaPositionY ?? DEFAULT_PRESET.mediaPositionY,
      character: parsed.character ?? DEFAULT_PRESET.character,
      characterPose: parsed.characterPose ?? DEFAULT_PRESET.characterPose,
      characterExpression: parsed.characterExpression ?? DEFAULT_PRESET.characterExpression,
      characterSize: parsed.characterSize ?? DEFAULT_PRESET.characterSize,
      textFont: parsed.textFont ?? DEFAULT_PRESET.textFont,
      textDecor: parsed.textDecor ?? DEFAULT_PRESET.textDecor,
      showTitle: parsed.showTitle ?? DEFAULT_PRESET.showTitle,
      showSubtitle: parsed.showSubtitle ?? DEFAULT_PRESET.showSubtitle,
      exportScale: parsed.exportScale ?? DEFAULT_PRESET.exportScale,
    };
  } catch {
    return DEFAULT_PRESET;
  }
}

function DeukgeunPoseAvatar({
  pose,
  expression,
  frame,
}: {
  pose: ShareCardCharacterPose;
  expression: CharacterExpression;
  frame: number;
}) {
  const poseLabel =
    pose === "squat" ? "SQ" :
    pose === "jump" ? "JP" :
    pose === "run" ? "RN" :
    pose === "fire" ? "PW" :
    pose === "victory" ? "V" :
    pose === "heart" ? "HT" :
    pose === "wave" ? "HI" : "FX";

  const eye = expression === "surprised" ? 3 : expression === "serious" ? 1.4 : 2;
  const mouthPath =
    expression === "surprised"
      ? "M27 30c1.4 0.6 3 1 5 1s3.6-.4 5-1"
      : expression === "serious"
        ? "M27 31h10"
        : expression === "proud"
          ? "M27 29c1.8 2.2 3.4 3 5 3s3.2-.8 5-3"
          : "M27 30c1.4 1.6 3 2.3 5 2.3s3.6-.7 5-2.3";
  const faceShiftY = Math.sin((frame / 100) * Math.PI * 2) * (pose === "jump" ? 1.8 : pose === "run" ? 1.2 : 0.8);

  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <defs>
        <linearGradient id={`dg-bg-${pose}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" fill={`url(#dg-bg-${pose})`} />
      <circle cx="32" cy="26" r="13" fill="#fde68a" />
      <rect x="19" y="40" width="26" height="12" rx="6" fill="#111827" />
      <ellipse cx="27" cy={25 + faceShiftY} rx={1.9} ry={eye} fill="#0f172a" />
      <ellipse cx="37" cy={25 + faceShiftY} rx={1.9} ry={eye} fill="#0f172a" />
      <path d={mouthPath} stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="8" y="42" width="8" height="8" rx="2" fill="#cbd5e1" />
      <rect x="48" y="42" width="8" height="8" rx="2" fill="#cbd5e1" />
      <text x="32" y="58" textAnchor="middle" fontSize="8" fill="#f8fafc" fontWeight="700">{poseLabel}</text>
    </svg>
  );
}

function ChevronDown() {
  return (
    <span className="chevron" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

function loadReactionStore(): ReactionStore {
  try {
    return JSON.parse(localStorage.getItem(REACTION_KEY) || "{}") as ReactionStore;
  } catch {
    return {};
  }
}

function saveReactionStore(next: ReactionStore) {
  localStorage.setItem(REACTION_KEY, JSON.stringify(next));
}

function buildTemplatePool(data: ShareData | null): string[] {
  if (!data) return ["오늘 출석 완료!", "작은 기록이 큰 변화를 만든다."];
  const pool = new Set<string>();
  pool.add("오늘도 출석 완료. 꾸준함이 답이다.");
  pool.add("작은 루틴이 결국 나를 바꾼다.");

  const types = data.workoutTypes ?? [];
  if (types.includes("weight")) pool.add("웨이트 루틴 클리어. 다음 기록도 갱신한다.");
  if (types.includes("cardio")) pool.add("유산소 완료. 숨찬 만큼 성장 중.");
  if (types.includes("stretch")) pool.add("스트레칭까지 챙긴 날. 회복도 훈련이다.");

  if ((data.workoutIntensity ?? "") === "hard") pool.add("강한 강도로 밀어붙인 날. 오늘도 전진.");
  if ((data.workoutIntensity ?? "") === "light") pool.add("가볍게라도 끊기지 않게. 루틴 유지 성공.");

  const streak = data.currentStreak ?? 0;
  if (streak >= 30) pool.add(`${streak}일 연속 출석. 루틴이 정체성이다.`);
  else if (streak >= 14) pool.add(`${streak}일 연속 출석 달성. 페이스 좋다.`);
  else if (streak >= 7) pool.add(`${streak}일 연속 출석. 이제부터 진짜 시작.`);
  else if (streak >= 3) pool.add(`${streak}일 연속 출석. 흐름 탄다.`);

  return Array.from(pool);
}

function waitForImageUrl(url: string, timeoutMs = 7000, retryMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const attempt = () => {
      if (Date.now() >= deadline) {
        finish(false);
        return;
      }
      const img = new Image();
      img.onload = () => finish(true);
      img.onerror = () => {
        window.setTimeout(attempt, retryMs);
      };
      img.src = url;
      if (img.complete && img.naturalWidth > 0) {
        finish(true);
      }
    };

    attempt();
  });
}

function extractBackgroundImageUrls(styleValue: string): string[] {
  if (!styleValue || styleValue === "none") return [];
  const matches = styleValue.matchAll(/url\((['"]?)(.*?)\1\)/g);
  return Array.from(matches, (match) => match[2]).filter(Boolean);
}

// html2canvas 는 CSS filter 를 그리지 않는다. 그래서 사진에 필터를 미리 입힌 이미지를 만들어
// 캡처용 복제본의 배경으로 바꿔 끼운다. (canvas filter 를 지원하지 않는 브라우저는 원본 그대로)
async function bakeMediaFilter(url: string, filter: string, maxSide = 2160): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx || !("filter" in ctx)) return null;
    ctx.filter = filter;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}

// 저장 배율 → 캡처 배율. 1080 기준이라 1이면 1080px, 2면 2160px. 폰 메모리와 속도를 위해 2배까지만.
const CAPTURE_SCALE: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2 };

function getCaptureSizeByRatio(ratio: ShareCardRatio): { width: number; height: number } {
  if (ratio === "square") return { width: 1080, height: 1080 };
  if (ratio === "story") return { width: 1080, height: 1920 };
  return { width: 1080, height: 1350 };
}

async function waitForCaptureAssets(root: HTMLElement): Promise<void> {
  const imageTasks: Promise<void>[] = [];

  const imageElements = Array.from(root.querySelectorAll("img"));
  imageElements.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) return;
    imageTasks.push(
      new Promise<void>((resolve) => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        window.setTimeout(done, 3000);
      })
    );
  });

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  const bgUrls = new Set<string>();
  nodes.forEach((node) => {
    const style = window.getComputedStyle(node).backgroundImage;
    extractBackgroundImageUrls(style).forEach((url) => bgUrls.add(url));
  });
  bgUrls.forEach((url) => imageTasks.push(waitForImageUrl(url).then(() => undefined)));

  await Promise.all(imageTasks);
}

export default function AttendanceShareView() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const fromAttendance = searchParams.get("from") === "attendance";
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [shareProgress, setShareProgress] = useState<"idle" | "sharing" | "saving">("idle");
  const [mediaReady, setMediaReady] = useState(true);
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);
  const [captureMediaUrl, setCaptureMediaUrl] = useState<string | null>(null);
  const [previewThumb, setPreviewThumb] = useState<string>("");

  const preset = useMemo(loadPreset, []);
  const [theme, setTheme] = useState<ShareCardTheme>(preset.theme);
  const [ratio, setRatio] = useState<ShareCardRatio>(preset.ratio);
  const [quoteStyle, setQuoteStyle] = useState<ShareCardQuoteStyle>(preset.quoteStyle);
  const [sticker, setSticker] = useState<string>(preset.sticker);
  const [showMeta, setShowMeta] = useState(preset.showMeta);
  const [mediaFit, setMediaFit] = useState<ShareCardMediaFit>(preset.mediaFit);
  const [mediaPositionX, setMediaPositionX] = useState<number>(preset.mediaPositionX);
  const [mediaPositionY, setMediaPositionY] = useState<number>(preset.mediaPositionY);
  const [character, setCharacter] = useState<ShareCardCharacter>(preset.character);
  const [characterPose, setCharacterPose] = useState<ShareCardCharacterPose>(preset.characterPose);
  const [characterExpression, setCharacterExpression] = useState<CharacterExpression>(preset.characterExpression);
  const [characterSize, setCharacterSize] = useState<number>(preset.characterSize);
  const [textFont, setTextFont] = useState<TextFontPreset>(preset.textFont);
  const [textDecor, setTextDecor] = useState<TextDecorPreset>(preset.textDecor);
  const [showTitle, setShowTitle] = useState<boolean>(preset.showTitle);
  const [showSubtitle, setShowSubtitle] = useState<boolean>(preset.showSubtitle);
  const [exportScale, setExportScale] = useState<1 | 2 | 3 | 4>(preset.exportScale);
  const effectiveExportScale: 1 | 2 | 3 | 4 = fromAttendance ? 4 : exportScale;
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    preset: false,
    themePack: true,
    advancedCard: false,
    text: false,
    photo: false,
    character: false,
    deco: false,
    message: false,
  });
  const [customMessage, setCustomMessage] = useState("");
  const [simpleMode, setSimpleMode] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [myCharacter, setMyCharacter] = useState<MyCharacterProfile | null>(null);
  const [myCharacterLoading, setMyCharacterLoading] = useState(false);
  const [themePack, setThemePack] = useState<ThemePackId | null>(null);
  const [decorations, setDecorations] = useState<DecoItem[]>([]);
  const [selectedDecoId, setSelectedDecoId] = useState<string | null>(null);
  const [titlePos, setTitlePos] = useState({ x: 8, y: 12 });
  const [subtitlePos, setSubtitlePos] = useState({ x: 8, y: 20 });
  const [photoFilter, setPhotoFilter] = useState({
    brightness: 106,
    contrast: 108,
    saturation: 112,
    warmth: 0,
    blur: 0,
  });
  const [transitionPlaying, setTransitionPlaying] = useState(false);
  const [manualFrame, setManualFrame] = useState(0);
  const [autoFrame, setAutoFrame] = useState(0);
  const [dragState, setDragState] = useState<{
    kind: "deco" | "title" | "subtitle";
    id?: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const previewCaptureRef = useRef<HTMLDivElement | null>(null);
  const autoActionTriggeredRef = useRef(false);
  // 공유용 카드 이미지를 미리 만들어 둔다. 공유 버튼을 누르는 순간 기다림 없이 navigator.share 를
  // 불러야 브라우저가 "사용자가 방금 누름"으로 인정해 준다 (await 로 렌더링하다 보면 그 인정이 만료된다).
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [preparingCard, setPreparingCard] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [arrivedForShare, setArrivedForShare] = useState(false);

  const [reactionStore, setReactionStore] = useState<ReactionStore>(() => loadReactionStore());

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/attendance/share/${slug}`);
        if (!res.ok) throw await httpError(res, "공유된 출석을 불러오지 못했어요.");
        const payload: ShareData = await res.json();
        setData(payload);
      } catch (e: unknown) {
        setError(friendlyError(e, "공유된 출석을 불러오지 못했어요."));
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (character !== "me") return;
    if (myCharacter || myCharacterLoading) return;
    (async () => {
      try {
        setMyCharacterLoading(true);
        const res = await fetch(`${API_BASE}/api/character/me`, { credentials: "include" });
        if (!res.ok) return;
        const payload: MyCharacterProfile = await res.json();
        setMyCharacter(payload);
      } finally {
        setMyCharacterLoading(false);
      }
    })();
  }, [character, myCharacter, myCharacterLoading]);

  useEffect(() => {
    if (!data) return;
    const seed = data.shareComment?.trim() || data.memo?.trim() || "오늘 출석 완료!";
    setCustomMessage(seed);
  }, [data?.shareSlug]);

  useEffect(() => {
    if (!transitionPlaying) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1000);
      setAutoFrame(Math.round(progress * 100));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTransitionPlaying(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transitionPlaying]);

  useEffect(() => {
    if (!dragState) return;
    const onMove = (event: MouseEvent) => {
      const root = previewCaptureRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const dxPercent = ((event.clientX - dragState.startClientX) / rect.width) * 100;
      const dyPercent = ((event.clientY - dragState.startClientY) / rect.height) * 100;
      const nx = Math.max(0, Math.min(95, dragState.startX + dxPercent));
      const ny = Math.max(0, Math.min(95, dragState.startY + dyPercent));

      if (dragState.kind === "title") {
        setTitlePos({ x: nx, y: ny });
      } else if (dragState.kind === "subtitle") {
        setSubtitlePos({ x: nx, y: ny });
      } else if (dragState.id) {
        setDecorations((prev) => prev.map((item) => (item.id === dragState.id ? { ...item, x: nx, y: ny } : item)));
      }
    };

    const onUp = () => setDragState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState]);

  const title = useMemo(() => {
    if (!data) return "출석 자랑";
    const name = data.authorNickname?.trim() || "회원";
    return `${name}님의 출석 자랑`;
  }, [data]);

  const templatePool = useMemo(() => buildTemplatePool(data), [data]);
  const activePose = useMemo(
    () => CHARACTER_POSE_OPTIONS.find((item) => item.id === characterPose) ?? CHARACTER_POSE_OPTIONS[0],
    [characterPose]
  );
  const showAdvancedControls = !simpleMode || advancedOpen;
  const showSimpleExtra = !simpleMode || advancedOpen;
  const effectiveFrame = transitionPlaying ? autoFrame : manualFrame;
  const selectedDeco = decorations.find((item) => item.id === selectedDecoId) ?? null;
  const titleClass = `share-heading-text font-${textFont} decor-${textDecor}`;
  const subtitleClass = `share-subheading-text font-${textFont}`;
  const mediaFilter = `brightness(${photoFilter.brightness}%) contrast(${photoFilter.contrast}%) saturate(${photoFilter.saturation}%) sepia(${Math.max(
    0,
    photoFilter.warmth / 100
  )}) blur(${photoFilter.blur}px)`;
  const expressionLabel = CHARACTER_EXPRESSION_OPTIONS.find((item) => item.id === characterExpression)?.label ?? "";
  const isSectionOpen = (key: SectionKey) => openSections[key];
  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const characterLift = useMemo(() => {
    const phase = (effectiveFrame / 100) * Math.PI * 2;
    if (characterPose === "jump") return -4 * Math.abs(Math.sin(phase));
    if (characterPose === "run") return -2 * Math.sin(phase);
    if (characterPose === "squat") return 2 * Math.abs(Math.sin(phase));
    return 0;
  }, [characterPose, effectiveFrame]);

  const appOrigin = window.location.origin;
  const publicShareOrigin = API_BASE || window.location.origin;
  const appShareLink = data ? `${appOrigin}/attendance/share/${data.shareSlug}` : "";
  const publicShareLink = data ? `${publicShareOrigin}/share/attendance/${data.shareSlug}` : "";

  const firstImage = useMemo(() => {
    if (!data?.mediaUrls?.length) return null;
    const image = data.mediaUrls.find((raw) => !isVideo(withBase(raw)));
    if (!image) return null;
    const absolute = withBase(image);
    return withProxy(absolute);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!firstImage) {
      setCaptureMediaUrl(null);
      setMediaReady(true);
      setMediaLoadFailed(false);
      return () => {
        cancelled = true;
      };
    }

    setMediaReady(false);
    setMediaLoadFailed(false);
    setCaptureMediaUrl(null);

    void (async () => {
      try {
        const res = await fetch(firstImage, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setCaptureMediaUrl(objectUrl);
        setMediaReady(true);
        setMediaLoadFailed(false);
      } catch {
        const loaded = await waitForImageUrl(firstImage, 9000, 300);
        if (cancelled) return;
        if (loaded) {
          setCaptureMediaUrl(firstImage);
          setMediaReady(true);
          setMediaLoadFailed(false);
        } else {
          setCaptureMediaUrl(null);
          setMediaReady(false);
          setMediaLoadFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [firstImage]);

  const addDecoration = (type: DecoType) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: DecoItem = { id, type, x: 48, y: 48, size: 1, rotation: 0, opacity: 0.95 };
    setDecorations((prev) => [...prev, next]);
    setSelectedDecoId(id);
  };

  const updateSelectedDeco = (patch: Partial<DecoItem>) => {
    if (!selectedDecoId) return;
    setDecorations((prev) => prev.map((item) => (item.id === selectedDecoId ? { ...item, ...patch } : item)));
  };

  const removeSelectedDeco = () => {
    if (!selectedDecoId) return;
    setDecorations((prev) => prev.filter((item) => item.id !== selectedDecoId));
    setSelectedDecoId(null);
  };

  const applyThemePack = (packId: ThemePackId) => {
    const pack = THEME_PACKS.find((item) => item.id === packId);
    if (!pack) return;
    setThemePack(packId);
    setTheme(pack.theme);
    setQuoteStyle(pack.quoteStyle);
    setSticker(pack.sticker);
    setTextFont(pack.textFont);
    setTextDecor(pack.textDecor);
    const nextDecos = pack.defaultDecos.map((item, idx) => ({
      ...item,
      id: `pack-${packId}-${idx}-${Date.now()}`,
    }));
    setDecorations(nextDecos);
    setSelectedDecoId(nextDecos[0]?.id ?? null);
  };

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      try {
        const thumb = await renderAttendanceShareCardPreviewDataUrl({
          date: data.date,
          didWorkout: data.didWorkout,
          workoutTypes: data.workoutTypes ?? [],
          workoutIntensity: data.workoutIntensity ?? null,
          memo: data.memo ?? null,
          shareComment: customMessage || data.shareComment || null,
          mediaUrl: captureMediaUrl,
          nickname: data.authorNickname ?? null,
          theme,
          ratio,
          quoteStyle,
          sticker,
          showMeta,
          mediaFit,
          mediaPositionX,
          mediaPositionY,
          character,
          characterPose,
          characterSize,
          characterLabel: character === "me" ? (data.authorNickname || "내 캐릭터") : "득근이",
          watermarkText: "득근득근",
          cheerCount: data.cheerCount ?? 0,
          showTitle,
          showSubtitle,
        });
        if (!cancelled) setPreviewThumb(thumb);
      } catch {
        if (!cancelled) setPreviewThumb("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    character,
    characterPose,
    characterSize,
    customMessage,
    data,
    captureMediaUrl,
    mediaFit,
    mediaPositionX,
    mediaPositionY,
    quoteStyle,
    ratio,
    showMeta,
    showSubtitle,
    showTitle,
    sticker,
    theme,
  ]);

  const composeShareText = () => {
    const message = customMessage.trim() || data?.memo?.trim() || "오늘 출석 완료!";
    return `${message}\n${publicShareLink}`;
  };
  const isCaptureBusy = shareProgress !== "idle";
  // 사진을 끝내 못 불러와도 사진 없는 카드로 공유할 수 있게 한다 (예전엔 버튼이 영영 잠겼다)
  const mediaSettled = mediaReady || mediaLoadFailed;
  const isActionDisabled = isCaptureBusy || !mediaSettled || preparingCard;
  const shareButtonLabel = !mediaSettled
    ? "사진 불러오는 중..."
    : preparingCard
      ? "카드 준비 중..."
      : shareProgress === "sharing"
        ? "공유 중..."
        : "공유하기";
  const saveButtonLabel = !mediaSettled
    ? "사진 불러오는 중..."
    : preparingCard
      ? "카드 준비 중..."
      : shareProgress === "saving"
        ? "저장 중..."
        : "카드 저장";
  const showLoadingOverlay = !mediaSettled;
  const overlayMessage = "사진을 불러오는 중...";

  const savePreset = () => {
    const next: SharePreset = {
      theme,
      ratio,
      quoteStyle,
      sticker,
      showMeta,
      mediaFit,
      mediaPositionX,
      mediaPositionY,
      character,
      characterPose,
      characterExpression,
      characterSize,
      textFont,
      textDecor,
      showTitle,
      showSubtitle,
      exportScale,
    };
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    toast("지금 설정을 프리셋으로 저장했어요.", "success");
  };

  const applyRandomTemplate = () => {
    if (templatePool.length === 0) return;
    const random = templatePool[Math.floor(Math.random() * templatePool.length)];
    setCustomMessage(random);
  };

  const buildShareImageBlob = async () => {
    if (!data) throw new Error("공유 데이터를 찾을 수 없어요.");
    return renderAttendanceShareCard({
      date: data.date,
      didWorkout: data.didWorkout,
      workoutTypes: data.workoutTypes ?? [],
      workoutIntensity: data.workoutIntensity ?? null,
      memo: data.memo ?? null,
      shareComment: customMessage || data.shareComment || null,
      mediaUrl: captureMediaUrl,
      nickname: data.authorNickname ?? null,
      theme,
      ratio,
      quoteStyle,
      sticker,
      showMeta,
      mediaFit,
      mediaPositionX,
      mediaPositionY,
      mediaBrightness: photoFilter.brightness,
      mediaContrast: photoFilter.contrast,
      mediaSaturation: photoFilter.saturation,
      mediaWarmth: photoFilter.warmth,
      mediaBlur: photoFilter.blur,
      character,
      characterPose,
      characterSize,
      characterLabel: character === "me" ? (data.authorNickname || "내 캐릭터") : "득근이",
      watermarkText: "득근득근",
      cheerCount: data.cheerCount ?? 0,
      showTitle,
      showSubtitle,
      scale: effectiveExportScale,
    });
  };

  const capturePreviewBlob = async (captureScale = 1) => {
    const captureNode = previewCaptureRef.current;
    if (!captureNode) throw new Error("공유 카드 캡처 대상을 찾을 수 없어요.");
    const { width: targetWidth, height: targetHeight } = getCaptureSizeByRatio(ratio);
    const bakedMedia = captureMediaUrl ? await bakeMediaFilter(captureMediaUrl, mediaFilter) : null;
    const stage = document.createElement("div");
    stage.setAttribute("data-capture-stage", "attendance-share");
    stage.style.position = "fixed";
    stage.style.left = "-100000px";
    stage.style.top = "0";
    stage.style.width = `${targetWidth}px`;
    stage.style.height = `${targetHeight}px`;
    stage.style.opacity = "0";
    stage.style.pointerEvents = "none";
    stage.style.overflow = "hidden";
    stage.style.zIndex = "-1";

    const clone = captureNode.cloneNode(true) as HTMLElement;
    clone.classList.add("exporting");
    clone.style.width = `${targetWidth}px`;
    clone.style.height = `${targetHeight}px`;
    clone.style.aspectRatio = `${targetWidth} / ${targetHeight}`;
    const mediaNode = clone.querySelector<HTMLElement>(".share-media-bg");
    if (mediaNode && bakedMedia) {
      mediaNode.style.backgroundImage = `url("${bakedMedia}")`;
      mediaNode.style.filter = "none";
    }
    stage.appendChild(clone);
    document.body.appendChild(stage);
    try {
      if (typeof document !== "undefined" && "fonts" in document) {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      }
      await waitForCaptureAssets(clone);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const rawCanvas = await html2canvas(clone, {
        backgroundColor: null,
        scale: captureScale,
        useCORS: true,
        allowTaint: false,
        ignoreElements: (element) => element.hasAttribute("data-html2canvas-ignore"),
        scrollX: 0,
        scrollY: 0,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        logging: false,
      });
      return await new Promise<Blob>((resolve, reject) => {
        rawCanvas.toBlob((file) => {
          if (!file) return reject(new Error("이미지 변환에 실패했어요."));
          resolve(file);
        }, "image/png");
      });
    } finally {
      stage.remove();
    }
  };

  const cardFileName = `attendance-share-${data?.date ?? "today"}.png`;

  // 카드 모양이 바뀌면 잠깐 기다렸다가(편집 중 매번 그리지 않게) 공유용 이미지를 미리 만든다.
  const cardSignature = JSON.stringify([
    data?.shareSlug,
    captureMediaUrl,
    theme,
    ratio,
    quoteStyle,
    sticker,
    showMeta,
    mediaFit,
    mediaPositionX,
    mediaPositionY,
    photoFilter,
    character,
    characterPose,
    characterExpression,
    characterSize,
    myCharacter?.avatarSeed,
    textFont,
    textDecor,
    showTitle,
    showSubtitle,
    titlePos,
    subtitlePos,
    decorations,
    customMessage,
    manualFrame,
  ]);

  useEffect(() => {
    if (!data || !mediaSettled || dragState || transitionPlaying) return;
    let cancelled = false;
    setPreparedFile(null);
    setPreparingCard(true);
    const timer = window.setTimeout(async () => {
      try {
        let blob: Blob;
        try {
          blob = await capturePreviewBlob(1);
        } catch {
          blob = await buildShareImageBlob();
        }
        if (!cancelled) setPreparedFile(new File([blob], cardFileName, { type: "image/png" }));
      } catch {
        if (!cancelled) setPreparedFile(null);
      } finally {
        if (!cancelled) setPreparingCard(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // 렌더 함수들은 매 렌더 새로 만들어지므로 의존성은 카드 모양(cardSignature)으로 대신한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSignature, mediaSettled, dragState, transitionPlaying]);

  const downloadFile = (file: Blob, name: string) => {
    const fileUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  };

  // 공유: 미리 만들어 둔 파일로 곧바로 navigator.share 를 부른다. 이 함수 안에서 공유 전에
  // await 를 하면 브라우저가 "사용자가 방금 누름" 인정을 거둬 NotAllowedError 가 난다.
  const quickShare = () => {
    if (!publicShareLink || isCaptureBusy) return;
    // 공유 창이 없는 브라우저도 있어서 share 를 선택 항목으로 다시 적는다.
    // (이 파일의 ShareData 는 출석 공유 데이터 타입이라 Web Share 용 타입을 따로 둔다)
    type WebShareData = { title?: string; text?: string; url?: string; files?: File[] };
    const nav = navigator as unknown as {
      share?: (payload: WebShareData) => Promise<void>;
      canShare?: (payload?: WebShareData) => boolean;
    };
    const share = nav.share?.bind(navigator);
    const file = preparedFile;
    const canShareFile = Boolean(file && share && nav.canShare?.({ files: [file] }));
    const message = customMessage.trim() || "오늘 출석 완료!";

    let sharing: Promise<void> | null = null;
    if (share && canShareFile && file) {
      sharing = share({ title: "출석 자랑", text: message, files: [file] });
    } else if (share) {
      sharing = share({ title: "출석 자랑", text: composeShareText(), url: publicShareLink });
    }

    if (!sharing) {
      // 공유 창이 없는 브라우저(대부분의 PC): 카드 저장 + 링크 복사
      if (file) downloadFile(file, file.name);
      void navigator.clipboard?.writeText(composeShareText()).catch(() => undefined);
      setShareNotice(file ? "공유 창을 지원하지 않는 브라우저라 카드를 저장하고 링크를 복사했어요." : "링크를 복사했어요.");
      return;
    }

    setShareProgress("sharing");
    setShareNotice(null);
    sharing
      .then(() => setShareNotice("공유했어요!"))
      .catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : "";
        if (name === "AbortError") return; // 사용자가 공유 창을 닫음 — 알릴 필요 없음
        if (name === "NotAllowedError") {
          setShareNotice("브라우저가 공유 창을 막았어요. 공유하기를 한 번 더 눌러 주세요.");
          return;
        }
        if (file) downloadFile(file, file.name);
        setShareNotice("공유에 실패해서 카드를 대신 저장했어요. 갤러리에서 올려 주세요.");
      })
      .finally(() => setShareProgress("idle"));
  };

  const saveImage = async () => {
    if (!data || isCaptureBusy) return;
    const scale = effectiveExportScale;
    // 기본 배율이면 미리 만들어 둔 카드를 그대로 저장한다
    if (preparedFile && CAPTURE_SCALE[scale] <= 1) {
      downloadFile(preparedFile, `attendance-card-${data.date}.png`);
      setShareNotice("카드를 저장했어요.");
      return;
    }
    try {
      setShareProgress("saving");
      let blob: Blob;
      try {
        blob = await capturePreviewBlob(CAPTURE_SCALE[scale]);
      } catch {
        blob = await buildShareImageBlob();
      }
      downloadFile(blob, `attendance-card-${data.date}-${scale}x.png`);
      setShareNotice("카드를 저장했어요.");
    } catch (e: unknown) {
      setShareNotice(e instanceof Error && e.message ? e.message : "이미지 저장에 실패했어요.");
    } finally {
      setShareProgress("idle");
    }
  };

  // 출석 화면에서 넘어온 경우(?auto=share|save).
  // 공유는 브라우저 규칙상 사용자가 직접 눌러야 하므로 자동으로 열지 않고, 카드가 준비되면 버튼을 안내한다.
  // 저장(다운로드)은 사용자 조작 없이도 되므로 준비되는 대로 저장한다.
  useEffect(() => {
    if (!data || autoActionTriggeredRef.current) return;
    const auto = searchParams.get("auto");
    if (auto !== "share" && auto !== "save") return;
    if (auto === "share") {
      autoActionTriggeredRef.current = true;
      setArrivedForShare(true);
      return;
    }
    if (!preparedFile) return;
    autoActionTriggeredRef.current = true;
    downloadFile(preparedFile, `attendance-card-${data.date}.png`);
    setShareNotice("카드를 저장했어요.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, preparedFile, searchParams]);

  const hasReacted = (kind: "cheer" | "report") => {
    if (!slug) return false;
    return Boolean(reactionStore[slug]?.[kind]);
  };

  const markReacted = (kind: "cheer" | "report") => {
    if (!slug) return;
    const next = {
      ...reactionStore,
      [slug]: {
        ...(reactionStore[slug] || {}),
        [kind]: true,
      },
    };
    setReactionStore(next);
    saveReactionStore(next);
  };

  const sendReaction = async (kind: "cheer" | "report") => {
    if (!data || sending) return;
    if (hasReacted(kind)) {
      toast(kind === "cheer" ? "이미 응원했어요." : "이미 신고했어요.");
      return;
    }

    try {
      setSending(true);
      // 신고는 로그인이 필요하다(서버가 쿠키로 사용자를 확인). 응원도 같은 방식으로 쿠키를 보낸다.
      const res = await fetch(`${API_BASE}/api/attendance/share/${data.shareSlug}/${kind}`, { method: "POST", credentials: "include" });
      if (res.status === 401) {
        toast(kind === "report" ? "로그인하면 신고할 수 있어요." : "로그인하면 응원할 수 있어요.", "error");
        return;
      }
      if (!res.ok) throw await httpError(res, kind === "cheer" ? "응원을 보내지 못했어요." : "신고를 접수하지 못했어요.");
      const payload: ShareData = await res.json();
      // 공개 응답에서 빠질 수 있는 값(memo·reportCount 등)은 기존 값을 지우지 않게 합친다
      setData((prev) => (prev ? { ...prev, ...payload } : payload));
      markReacted(kind);
      toast(kind === "report" ? "신고가 접수됐어요. 운영진이 확인할게요." : "응원을 보냈어요.", "success");
    } catch (e: unknown) {
      toast(friendlyError(e, "처리하지 못했어요. 다시 시도해 주세요."), "error");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <section className="attendance-share-page theme-sunset">
        <div className="share-shell share-state">
          <span className="dg-loading-plates" aria-hidden="true"><i /><i /><i /><i /></span>
          불러오는 중...
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="attendance-share-page theme-sunset">
        <div className="share-shell share-state">
          <div className="dg-steel share-error">{error || "공유 페이지를 찾을 수 없습니다."}</div>
        </div>
      </section>
    );
  }

  return (
    <section className={`attendance-share-page theme-${theme}`}>
      <div className="share-shell">
        <div className="share-head mb-6 dg-rise">
          <p className="share-eyebrow">출석 자랑 카드</p>
          <h1 className="text-3xl md:text-5xl mt-2 text-chalk">{title}</h1>
          <p className="text-sm text-steel-300 mt-2">
            {data.date} · {data.didWorkout ? "운동 완료" : "휴식 기록"} · 연속 {data.currentStreak ?? 0}일
          </p>
        </div>

        <div className="share-grid">
          <div className="share-panel dg-steel dg-rise" role="region" aria-label="카드 미리보기">
            {/* 화면 미리보기용 받침: 카드 템플릿 테마 색(--bg-a/b/c)을 카드 뒤에 깔아 준다. 캡처 대상(share-preview)은 그대로. */}
            <div className={`share-preview-stage ratio-${ratio}`}>
            <div ref={previewCaptureRef} className={`share-preview ratio-${ratio}`}>
              {captureMediaUrl && (
                <div
                  className="share-media-bg"
                  style={{
                    backgroundImage: `url("${captureMediaUrl}")`,
                    backgroundSize: mediaFit === "cover" ? "cover" : "contain",
                    backgroundPosition: `${mediaPositionX}% ${mediaPositionY}%`,
                    filter: mediaFilter,
                  }}
                />
              )}
              <div className="share-overlay" />
              {/* 워터마크: 앱 상단 로고와 같은 25kg 원판 + 이름, 볼트 철판 이름표(짐 플로어 v2). 이미지가 아니라 1080px 저장본도 선명하다 */}
              <div className="share-logo" aria-label="득근득근 musclehub.co.kr">
                <div className="share-brand">
                  <svg viewBox="0 0 34 34" className="share-brand-plate" aria-hidden="true">
                    <circle cx="17" cy="17" r="15" fill="#D9302A" stroke="#0E0E10" strokeWidth="3" />
                    <circle cx="17" cy="17" r="9" fill="none" stroke="#0E0E10" strokeWidth="1.5" opacity="0.5" />
                    <circle cx="17" cy="17" r="4.5" fill="#B8BBC0" stroke="#0E0E10" strokeWidth="2" />
                  </svg>
                  <span className="share-brand-text">
                    <span className="share-brand-name">득근득근</span>
                    <span className="share-brand-url">musclehub.co.kr</span>
                  </span>
                </div>
              </div>
              {showLoadingOverlay && (
                <div className="share-loading-overlay" aria-live="polite" data-html2canvas-ignore="true">
                  <span className="dg-loading-plates share-loading-plates" aria-hidden="true"><i /><i /><i /><i /></span>
                  <p className="share-loading-text">{overlayMessage}</p>
                </div>
              )}
              {sticker && <div className="share-sticker">{sticker}</div>}
              <div className="share-deco-layer">
                {decorations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`share-deco-item ${selectedDecoId === item.id ? "selected" : ""}`}
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      transform: `translate(-50%, -50%) scale(${item.size}) rotate(${item.rotation}deg)`,
                      opacity: item.opacity,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedDecoId(item.id);
                      setDragState({
                        kind: "deco",
                        id: item.id,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startX: item.x,
                        startY: item.y,
                      });
                    }}
                  >
                    {item.type === "deukgeun" ? (
                      <span className="deco-character-node">
                        <DeukgeunPoseAvatar pose={characterPose} expression={characterExpression} frame={effectiveFrame} />
                      </span>
                    ) : item.type === "mychar" ? (
                      <span className="deco-character-node">
                        {myCharacter ? (
                          <AvatarRenderer
                            avatarSeed={myCharacter.avatarSeed}
                            growthParams={myCharacter.growthParams ?? defaultGrowthParams}
                            tier={myCharacter.tier}
                            stage={myCharacter.evolutionStage}
                            gender={myCharacter.gender}
                            size={46}
                          />
                        ) : (
                          <span className="deco-character-fallback">{data.authorNickname?.[0] || "나"}</span>
                        )}
                      </span>
                    ) : (
                      DECO_GLYPH[item.type]
                    )}
                  </button>
                ))}
              </div>
              {showTitle && (
                <div
                  className={`share-heading-layer ${titleClass}`}
                  style={{ left: `${titlePos.x}%`, top: `${titlePos.y}%` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragState({
                      kind: "title",
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startX: titlePos.x,
                      startY: titlePos.y,
                    });
                  }}
                >
                  {data.didWorkout ? "Workout Complete" : "Recovery Day"}
                </div>
              )}
              {showSubtitle && (
                <div
                  className={subtitleClass}
                  style={{ left: `${subtitlePos.x}%`, top: `${subtitlePos.y}%` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragState({
                      kind: "subtitle",
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startX: subtitlePos.x,
                      startY: subtitlePos.y,
                    });
                  }}
                >
                  {data.authorNickname ?? "회원"} · {data.date}
                </div>
              )}
              {character !== "none" && (
                <div
                  className={`share-character ${character === "deukgeun" ? "deukgeun" : "me"} pose-${characterPose}`}
                  style={{ transform: `translateY(${characterLift}px) scale(${characterSize})` }}
                >
                  <div className="share-character-avatar">
                    {character === "deukgeun" ? (
                      <DeukgeunPoseAvatar pose={characterPose} expression={characterExpression} frame={effectiveFrame} />
                    ) : myCharacter ? (
                      <AvatarRenderer
                        avatarSeed={myCharacter.avatarSeed}
                        growthParams={myCharacter.growthParams ?? defaultGrowthParams}
                        tier={myCharacter.tier}
                        stage={myCharacter.evolutionStage}
                        gender={myCharacter.gender}
                        size={54}
                      />
                    ) : (
                      data.authorNickname?.[0] || "나"
                    )}
                  </div>
                  <div className="share-character-meta">
                    <strong>{character === "deukgeun" ? "득근이" : "내 캐릭터"}</strong>
                    <span>{activePose.label} · {expressionLabel}</span>
                  </div>
                </div>
              )}

              {ratio === "story" && (
                <>
                  <div className="story-safe top" aria-hidden="true" data-html2canvas-ignore="true">스토리 안전 영역</div>
                  <div className="story-safe bottom" aria-hidden="true" data-html2canvas-ignore="true">스토리 안전 영역</div>
                </>
              )}

              <div className="share-content">
                <p className="share-attendance-label">Attendance</p>

                <p className={`share-quote quote-${quoteStyle}`}>{customMessage || data.shareComment || data.memo || "오늘 출석 완료!"}</p>

                {showMeta && (
                  <p className="share-meta">응원 {data.cheerCount ?? 0} · 득근득근</p>
                )}
              </div>
            </div>
            </div>

            {/* 메모는 공개 응답에서 빠질 수 있다. 없으면 칸 자체를 숨긴다(예전엔 "메모 없음"이 떴다) */}
            {data.memo?.trim() && (
              <div className="share-memo dg-whiteboard mt-5">
                <p className="share-memo-title font-pen">오늘의 메모</p>
                <p className="whitespace-pre-line">{data.memo}</p>
              </div>
            )}
          </div>

          <div className="share-panel share-controls dg-steel dg-rise" style={{ animationDelay: "80ms" }} role="region" aria-label="카드 꾸미기">
            <div className="quick-action-dock">
              <button className={`action-btn primary quick-action-btn dg-btn dg-btn-primary ${arrivedForShare && preparedFile ? "share-ready-pulse" : ""}`} onClick={quickShare} disabled={isActionDisabled}>
                {isActionDisabled ? (
                  <span className="action-btn-loading">
                    <span className="dg-loading-plates action-btn-spinner" aria-hidden="true"><i /><i /><i /><i /></span>
                    <span>{shareButtonLabel}</span>
                  </span>
                ) : (
                  shareButtonLabel
                )}
              </button>
              <button className="action-btn quick-action-btn dg-btn dg-btn-steel" onClick={saveImage} disabled={isActionDisabled}>
                {isActionDisabled ? (
                  <span className="action-btn-loading">
                    <span className="dg-loading-plates action-btn-spinner" aria-hidden="true"><i /><i /><i /><i /></span>
                    <span>{saveButtonLabel}</span>
                  </span>
                ) : (
                  saveButtonLabel
                )}
              </button>
              {(shareNotice || arrivedForShare || mediaLoadFailed) && (
                <p className="share-notice" role="status" aria-live="polite">
                  {shareNotice ??
                    (mediaLoadFailed
                      ? "사진을 불러오지 못해 사진 없이 카드를 만들었어요."
                      : preparedFile
                        ? "카드가 준비됐어요. 공유하기를 눌러 주세요."
                        : "카드를 만들고 있어요. 준비되면 공유하기를 눌러 주세요.")}
                </p>
              )}
              <div className="quick-toggle">
                <p className="control-subtitle">사진 맞춤</p>
                <div className="choice-wrap">
                  {MEDIA_FIT_OPTIONS.map((option) => (
                    <button
                      key={`quick-media-fit-${option.id}`}
                      className={`choice-btn ${mediaFit === option.id ? "active" : ""}`}
                      onClick={() => setMediaFit(option.id)}
                      aria-label={`사진 맞춤 ${option.label}`}
                      aria-pressed={mediaFit === option.id}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className={`choice-btn section-toggle quick-toggle ${customizeOpen ? "open" : ""}`}
                onClick={() => setCustomizeOpen((prev) => !prev)}
                aria-expanded={customizeOpen}
              >
                <span>{customizeOpen ? "꾸미기 옵션 닫기" : "꾸미기 옵션 펼치기"}</span>
                <ChevronDown />
              </button>
            </div>

            {customizeOpen && (
              <>
            <div className="control-row">
              <p className="control-title">UI 모드</p>
              <div className="choice-wrap">
                <button className={`choice-btn ${simpleMode ? "active" : ""}`} onClick={() => setSimpleMode(true)}>초간단</button>
                <button className={`choice-btn ${!simpleMode ? "active" : ""}`} onClick={() => setSimpleMode(false)}>전문가</button>
              </div>
            </div>

            {simpleMode && (
              <div className="control-row simple-core-bar">
                <button className="action-btn dg-btn dg-btn-steel" onClick={saveImage} disabled={isActionDisabled}>
                  {isActionDisabled ? (
                    <span className="action-btn-loading">
                      <span className="dg-loading-plates action-btn-spinner" aria-hidden="true"><i /><i /><i /><i /></span>
                      <span>{saveButtonLabel}</span>
                    </span>
                  ) : (
                    saveButtonLabel
                  )}
                </button>
                <button
                  className={`choice-btn section-toggle compact ${advancedOpen ? "open" : ""}`}
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  aria-expanded={advancedOpen}
                >
                  <span>{advancedOpen ? "더보기 닫기" : "더보기"}</span>
                  <ChevronDown />
                </button>
              </div>
            )}

            {showSimpleExtra && (
              <div className="control-row">
                <button
                  className={`choice-btn section-toggle ${isSectionOpen("preset") ? "open" : ""}`}
                  onClick={() => toggleSection("preset")}
                  aria-expanded={isSectionOpen("preset")}
                >
                  <span>프리셋</span>
                  <ChevronDown />
                </button>
                {isSectionOpen("preset") && (
                  <div className="control-section">
                    <div className="choice-wrap">
                      <button className="choice-btn" onClick={savePreset}>현재 설정 저장</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="control-row">
              <button
                className={`choice-btn section-toggle ${isSectionOpen("themePack") ? "open" : ""}`}
                onClick={() => toggleSection("themePack")}
                aria-expanded={isSectionOpen("themePack")}
              >
                <span>프레임/테마팩</span>
                <ChevronDown />
              </button>
              {isSectionOpen("themePack") && (
                <div className="control-section">
                  <div className="choice-wrap">
                    {THEME_PACKS.map((pack) => (
                      <button
                        key={pack.id}
                        className={`choice-btn ${themePack === pack.id ? "active" : ""}`}
                        onClick={() => applyThemePack(pack.id)}
                      >
                        {pack.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showAdvancedControls && (
              <div className="control-row">
                <button
                  className={`choice-btn section-toggle ${isSectionOpen("advancedCard") ? "open" : ""}`}
                  onClick={() => toggleSection("advancedCard")}
                  aria-expanded={isSectionOpen("advancedCard")}
                >
                  <span>고급 카드 설정</span>
                  <ChevronDown />
                </button>
                {isSectionOpen("advancedCard") && (
                  <div className="control-section">
                    <p className="control-subtitle">테마</p>
                    <div className="choice-wrap">
                      {THEME_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`choice-btn ${theme === option.id ? "active" : ""}`}
                          onClick={() => setTheme(option.id)}
                          aria-label={`테마 ${option.label}`}
                          aria-pressed={theme === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">이미지 비율</p>
                    <div className="choice-wrap">
                      {RATIO_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`choice-btn ${ratio === option.id ? "active" : ""}`}
                          onClick={() => setRatio(option.id)}
                          aria-label={`비율 ${option.label}`}
                          aria-pressed={ratio === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">문구 상자</p>
                    <div className="choice-wrap">
                      {QUOTE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`choice-btn ${quoteStyle === option.id ? "active" : ""}`}
                          onClick={() => setQuoteStyle(option.id)}
                          aria-label={`문구 상자 ${option.label}`}
                          aria-pressed={quoteStyle === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">스티커</p>
                    <div className="choice-wrap">
                      {STICKERS.map((item) => (
                        <button
                          key={item || "none"}
                          className={`choice-btn ${sticker === item ? "active" : ""}`}
                          onClick={() => setSticker(item)}
                          aria-label={`스티커 ${item || "없음"}`}
                          aria-pressed={sticker === item}
                        >
                          {item || "없음"}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">저장 화질</p>
                    <div className="choice-wrap">
                      {[1, 2, 3, 4].map((scale) => (
                        <button
                          key={scale}
                          className={`choice-btn ${exportScale === scale ? "active" : ""}`}
                          onClick={() => setExportScale(scale as 1 | 2 | 3 | 4)}
                          aria-label={`저장 화질 ${scale}배`}
                          aria-pressed={exportScale === scale}
                        >
                          {scale}배
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input id="meta-toggle" type="checkbox" checked={showMeta} onChange={(e) => setShowMeta(e.target.checked)} />
                      <label htmlFor="meta-toggle" className="text-sm text-steel-200">응원/공유 메타 표시</label>
                    </div>
                    {previewThumb && (
                      <div className="mt-3">
                        <p className="control-subtitle">미리보기</p>
                        <img src={previewThumb} alt="공유 카드 작은 미리보기" className="thumb-preview" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showSimpleExtra && (
              <div className="control-row">
                <button
                  className={`choice-btn section-toggle ${isSectionOpen("text") ? "open" : ""}`}
                  onClick={() => toggleSection("text")}
                  aria-expanded={isSectionOpen("text")}
                >
                  <span>텍스트 꾸미기</span>
                  <ChevronDown />
                </button>
                {isSectionOpen("text") && (
                  <div className="control-section">
                  <div className="choice-wrap">
                    <button className={`choice-btn ${showTitle ? "active" : ""}`} onClick={() => setShowTitle((prev) => !prev)}>
                      타이틀 {showTitle ? "보임" : "숨김"}
                    </button>
                    <button className={`choice-btn ${showSubtitle ? "active" : ""}`} onClick={() => setShowSubtitle((prev) => !prev)}>
                      닉네임 {showSubtitle ? "보임" : "숨김"}
                    </button>
                  </div>
                  <div className="choice-wrap mt-2">
                    {TEXT_FONT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice-btn ${textFont === option.id ? "active" : ""}`}
                        onClick={() => setTextFont(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="choice-wrap mt-2">
                    {TEXT_DECOR_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice-btn ${textDecor === option.id ? "active" : ""}`}
                        onClick={() => setTextDecor(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="choice-wrap mt-2">
                    <button
                      className="choice-btn"
                      onClick={() => {
                        setTitlePos({ x: 8, y: 12 });
                        setSubtitlePos({ x: 8, y: 20 });
                      }}
                    >
                      제목 위치 초기화
                    </button>
                  </div>
                  <p className="text-xs text-steel-400 mt-2">제목/서브텍스트는 카드에서 직접 드래그해서 위치 이동할 수 있어요.</p>
                </div>
                )}
              </div>
            )}

            <div className="control-row">
              <button
                className={`choice-btn section-toggle ${isSectionOpen("photo") ? "open" : ""}`}
                onClick={() => toggleSection("photo")}
                aria-expanded={isSectionOpen("photo")}
              >
                <span>사진 세부 설정</span>
                <ChevronDown />
              </button>
              {isSectionOpen("photo") && (
                <div className="control-section">
                  <p className="control-subtitle">사진 위치</p>
                  <div className="range-grid mt-3">
                    <label className="range-label">
                      좌우 위치 {mediaPositionX}%
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={mediaPositionX}
                        onChange={(e) => setMediaPositionX(Number(e.target.value))}
                        disabled={!firstImage || mediaFit !== "cover"}
                      />
                    </label>
                    <label className="range-label">
                      상하 위치 {mediaPositionY}%
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={mediaPositionY}
                        onChange={(e) => setMediaPositionY(Number(e.target.value))}
                        disabled={!firstImage || mediaFit !== "cover"}
                      />
                    </label>
                  </div>
                  {!firstImage && <p className="text-xs text-steel-400 mt-2">사진이 없어서 위치 조절은 비활성화돼요.</p>}

                  <p className="control-subtitle mt-3">사진 편집</p>
                  <div className="range-grid">
                    <label className="range-label">
                      밝기 {photoFilter.brightness}%
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={photoFilter.brightness}
                        onChange={(e) => setPhotoFilter((prev) => ({ ...prev, brightness: Number(e.target.value) }))}
                        disabled={!firstImage}
                      />
                    </label>
                    <label className="range-label">
                      대비 {photoFilter.contrast}%
                      <input
                        type="range"
                        min={50}
                        max={170}
                        value={photoFilter.contrast}
                        onChange={(e) => setPhotoFilter((prev) => ({ ...prev, contrast: Number(e.target.value) }))}
                        disabled={!firstImage}
                      />
                    </label>
                    <label className="range-label">
                      채도 {photoFilter.saturation}%
                      <input
                        type="range"
                        min={50}
                        max={170}
                        value={photoFilter.saturation}
                        onChange={(e) => setPhotoFilter((prev) => ({ ...prev, saturation: Number(e.target.value) }))}
                        disabled={!firstImage}
                      />
                    </label>
                    <label className="range-label">
                      따뜻함 {photoFilter.warmth}
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={photoFilter.warmth}
                        onChange={(e) => setPhotoFilter((prev) => ({ ...prev, warmth: Number(e.target.value) }))}
                        disabled={!firstImage}
                      />
                    </label>
                    <label className="range-label">
                      흐림 {photoFilter.blur}px
                      <input
                        type="range"
                        min={0}
                        max={6}
                        value={photoFilter.blur}
                        onChange={(e) => setPhotoFilter((prev) => ({ ...prev, blur: Number(e.target.value) }))}
                        disabled={!firstImage}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="control-row">
              <button
                className={`choice-btn section-toggle ${isSectionOpen("character") ? "open" : ""}`}
                onClick={() => toggleSection("character")}
                aria-expanded={isSectionOpen("character")}
              >
                <span>캐릭터</span>
                <ChevronDown />
              </button>
              {isSectionOpen("character") && (
                <div className="control-section">
                  <div className="choice-wrap">
                    {CHARACTER_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice-btn ${character === option.id ? "active" : ""}`}
                        onClick={() => setCharacter(option.id)}
                        aria-label={`캐릭터 ${option.label}`}
                        aria-pressed={character === option.id}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {character !== "none" && (
                    <>
                      <div className="choice-wrap mt-2">
                        {CHARACTER_POSE_OPTIONS.map((pose) => (
                          <button
                            key={pose.id}
                            className={`choice-btn ${characterPose === pose.id ? "active" : ""}`}
                            onClick={() => setCharacterPose(pose.id)}
                            aria-label={`포즈 ${pose.label}`}
                            aria-pressed={characterPose === pose.id}
                          >
                            {pose.label}
                          </button>
                        ))}
                      </div>
                      <div className="range-grid mt-3">
                        <label className="range-label">
                          캐릭터 크기 {characterSize.toFixed(2)}x
                          <input
                            type="range"
                            min={0.65}
                            max={1.8}
                            step={0.01}
                            value={characterSize}
                            onChange={(e) => setCharacterSize(Number(e.target.value))}
                          />
                        </label>
                      </div>
                      <div className="choice-wrap mt-2">
                        {CHARACTER_EXPRESSION_OPTIONS.map((exp) => (
                          <button
                            key={exp.id}
                            className={`choice-btn ${characterExpression === exp.id ? "active" : ""}`}
                            onClick={() => setCharacterExpression(exp.id)}
                          >
                            {exp.label}
                          </button>
                        ))}
                      </div>
                      <div className="range-grid mt-3">
                        <label className="range-label">
                          정지샷 프레임 {effectiveFrame}
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={transitionPlaying ? autoFrame : manualFrame}
                            onChange={(e) => {
                              setTransitionPlaying(false);
                              setManualFrame(Number(e.target.value));
                            }}
                          />
                        </label>
                      </div>
                      <div className="choice-wrap mt-2">
                        <button className="choice-btn" onClick={() => setTransitionPlaying(true)} disabled={transitionPlaying}>
                          {transitionPlaying ? "애니메이션 재생 중..." : "1초 포즈 미리보기"}
                        </button>
                      </div>
                    </>
                  )}
                  {character === "me" && !myCharacter && (
                    <p className="text-xs text-steel-400 mt-2">
                      {myCharacterLoading ? "내 캐릭터 정보를 불러오는 중..." : "로그인 상태가 아니면 내 캐릭터를 표시할 수 없어요."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {showSimpleExtra && (
              <div className="control-row">
                <button
                  className={`choice-btn section-toggle ${isSectionOpen("deco") ? "open" : ""}`}
                  onClick={() => toggleSection("deco")}
                  aria-expanded={isSectionOpen("deco")}
                >
                  <span>배경 데코 레이어</span>
                  <ChevronDown />
                </button>
                {isSectionOpen("deco") && (
                  <div className="control-section">
                  <div className="choice-wrap">
                    <button className="choice-btn" onClick={() => addDecoration("star")}>별 추가</button>
                    <button className="choice-btn" onClick={() => addDecoration("heart")}>하트 추가</button>
                    <button className="choice-btn" onClick={() => addDecoration("bolt")}>번개 추가</button>
                    <button className="choice-btn" onClick={() => addDecoration("tape")}>테이프 추가</button>
                    <button className="choice-btn" onClick={() => addDecoration("mychar")}>내 캐릭터 데코</button>
                    <button className="choice-btn" onClick={() => addDecoration("deukgeun")}>득근이 데코</button>
                  </div>
                  {selectedDeco && (
                    <div className="range-grid mt-3">
                      <label className="range-label">
                        크기 {selectedDeco.size.toFixed(2)}x
                        <input
                          type="range"
                          min={0.4}
                          max={2.2}
                          step={0.01}
                          value={selectedDeco.size}
                          onChange={(e) => updateSelectedDeco({ size: Number(e.target.value) })}
                        />
                      </label>
                      <label className="range-label">
                        회전 {Math.round(selectedDeco.rotation)}°
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={selectedDeco.rotation}
                          onChange={(e) => updateSelectedDeco({ rotation: Number(e.target.value) })}
                        />
                      </label>
                      <label className="range-label">
                        투명도 {Math.round(selectedDeco.opacity * 100)}%
                        <input
                          type="range"
                          min={10}
                          max={100}
                          value={Math.round(selectedDeco.opacity * 100)}
                          onChange={(e) => updateSelectedDeco({ opacity: Number(e.target.value) / 100 })}
                        />
                      </label>
                      <button className="choice-btn" onClick={removeSelectedDeco}>선택 데코 삭제</button>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}


            {showSimpleExtra && (
              <div className="control-row">
                <button
                  className={`choice-btn section-toggle ${isSectionOpen("message") ? "open" : ""}`}
                  onClick={() => toggleSection("message")}
                  aria-expanded={isSectionOpen("message")}
                >
                  <span>자랑 멘트</span>
                  <ChevronDown />
                </button>
                {isSectionOpen("message") && (
                  <div className="control-section">
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="comment-editor"
                    maxLength={280}
                    placeholder="자랑 멘트를 적어보세요"
                    aria-label="자랑 멘트"
                  />
                  <div className="choice-wrap mt-2">
                    {templatePool.slice(0, 3).map((template) => (
                      <button key={template} className="choice-btn" onClick={() => setCustomMessage(template)} aria-label={`템플릿 넣기: ${template}`}>
                        템플릿
                      </button>
                    ))}
                    <button className="choice-btn" onClick={applyRandomTemplate}>랜덤 추천</button>
                  </div>
                  <p className="text-xs text-steel-400 mt-2 font-num">{customMessage.length}/280</p>
                </div>
                )}
              </div>
            )}

            <div className="action-list">
              <button className={`action-btn primary dg-btn dg-btn-primary ${arrivedForShare && preparedFile ? "share-ready-pulse" : ""}`} onClick={quickShare} disabled={isActionDisabled}>
                {isActionDisabled ? (
                  <span className="action-btn-loading">
                    <span className="dg-loading-plates action-btn-spinner" aria-hidden="true"><i /><i /><i /><i /></span>
                    <span>{shareButtonLabel}</span>
                  </span>
                ) : (
                  shareButtonLabel
                )}
              </button>
              <button className="action-btn dg-btn dg-btn-steel" onClick={saveImage} disabled={isActionDisabled}>
                {isActionDisabled ? (
                  <span className="action-btn-loading">
                    <span className="dg-loading-plates action-btn-spinner" aria-hidden="true"><i /><i /><i /><i /></span>
                    <span>{saveButtonLabel}</span>
                  </span>
                ) : (
                  saveButtonLabel
                )}
              </button>
              {showSimpleExtra && (
                <>
                  <button className="action-btn dg-btn dg-btn-steel" onClick={async () => { await navigator.clipboard.writeText(composeShareText()); toast("멘트와 링크를 복사했어요.", "success"); }}>
                    멘트+링크 복사
                  </button>
                  <button
                    disabled={sending || hasReacted("cheer")}
                    className="action-btn dg-btn dg-btn-steel"
                    onClick={() => sendReaction("cheer")}
                   
                  >
                    응원하기 {data.cheerCount ?? 0}
                  </button>
                  <button
                    disabled={sending || hasReacted("report")}
                    className="action-btn dg-btn dg-btn-steel"
                    onClick={() => sendReaction("report")}
                   
                  >
                    신고하기
                  </button>
                  <a href={appShareLink} className="action-btn dg-btn dg-btn-steel" aria-label="이 공유 페이지 링크 열기">현재 페이지 링크</a>
                  <Link to="/" className="action-btn dg-btn dg-btn-steel">홈으로</Link>
                </>
              )}
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}



