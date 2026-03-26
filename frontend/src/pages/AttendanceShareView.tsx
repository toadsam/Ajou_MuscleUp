import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import { defaultGrowthParams, type GrowthParams } from "../components/avatar/types";
import { Link, useParams } from "react-router-dom";
import {
  type ShareCardCharacter,
  type ShareCardCharacterPose,
  type ShareCardMediaFit,
  renderAttendanceShareCard,
  renderAttendanceShareCardPreviewDataUrl,
  type ShareCardQuoteStyle,
  type ShareCardRatio,
  type ShareCardTheme,
} from "../utils/attendanceShareCard";
import "../styles/attendanceShare.css";

type ShareData = {
  id: number;
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
  mediaUrls?: string[] | null;
  authorNickname?: string | null;
  cheerCount: number;
  reportCount: number;
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
  exportScale: 1 | 2 | 3;
};

type ReactionStore = Record<string, { cheer?: boolean; report?: boolean }>;

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const PRESET_KEY = "attendance_share_preset_v1";
const REACTION_KEY = "attendance_share_reaction_v1";

const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url.split("?")[0]);

const THEME_OPTIONS: Array<{ id: ShareCardTheme; label: string }> = [
  { id: "sunset", label: "Sunset" },
  { id: "mint", label: "Mint" },
  { id: "midnight", label: "Midnight" },
];

const RATIO_OPTIONS: Array<{ id: ShareCardRatio; label: string }> = [
  { id: "feed", label: "Feed 4:5" },
  { id: "square", label: "Square" },
  { id: "story", label: "Story 9:16" },
];

const QUOTE_OPTIONS: Array<{ id: ShareCardQuoteStyle; label: string }> = [
  { id: "glass", label: "Glass" },
  { id: "outline", label: "Outline" },
  { id: "solid", label: "Solid" },
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

const CHARACTER_POSE_OPTIONS: Array<{ id: ShareCardCharacterPose; label: string; emoji: string }> = [
  { id: "flex", label: "근육", emoji: "💪" },
  { id: "wave", label: "인사", emoji: "👋" },
  { id: "heart", label: "하트", emoji: "🫶" },
  { id: "victory", label: "브이", emoji: "✌️" },
  { id: "fire", label: "파워", emoji: "🔥" },
  { id: "squat", label: "스쿼트", emoji: "🏋️" },
  { id: "jump", label: "점프", emoji: "🕺" },
  { id: "run", label: "러닝", emoji: "🏃" },
];

const CHARACTER_EXPRESSION_OPTIONS: Array<{ id: CharacterExpression; label: string; emoji: string }> = [
  { id: "smile", label: "웃음", emoji: "😊" },
  { id: "proud", label: "뿌듯", emoji: "😎" },
  { id: "serious", label: "진지", emoji: "🧐" },
  { id: "surprised", label: "놀람", emoji: "😮" },
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
  exportScale: 2,
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
      sticker: parsed.sticker ?? DEFAULT_PRESET.sticker,
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

export default function AttendanceShareView() {
  const { slug } = useParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(preset.exportScale);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    preset: false,
    themePack: true,
    advancedCard: false,
    text: false,
    photo: true,
    character: true,
    deco: false,
    message: false,
  });
  const [customMessage, setCustomMessage] = useState("");
  const [simpleMode, setSimpleMode] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [myCharacter, setMyCharacter] = useState<MyCharacterProfile | null>(null);
  const [myCharacterLoading, setMyCharacterLoading] = useState(false);
  const [themePack, setThemePack] = useState<ThemePackId | null>(null);
  const [decorations, setDecorations] = useState<DecoItem[]>([]);
  const [selectedDecoId, setSelectedDecoId] = useState<string | null>(null);
  const [titlePos, setTitlePos] = useState({ x: 8, y: 12 });
  const [subtitlePos, setSubtitlePos] = useState({ x: 8, y: 20 });
  const [photoFilter, setPhotoFilter] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
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

  const [reactionStore, setReactionStore] = useState<ReactionStore>(() => loadReactionStore());

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/attendance/share/${slug}`);
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const payload: ShareData = await res.json();
        setData(payload);
      } catch (e: any) {
        setError(e?.message || "공유된 출석을 불러오지 못했어요.");
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
  const expressionLabel = CHARACTER_EXPRESSION_OPTIONS.find((item) => item.id === characterExpression)?.emoji ?? "😊";
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
    return image ? withBase(image) : null;
  }, [data]);

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
          mediaUrl: firstImage,
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
          cheerCount: data.cheerCount,
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
    firstImage,
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
    alert("커스텀 프리셋을 저장했어요.");
  };

  const applyRandomTemplate = () => {
    if (templatePool.length === 0) return;
    const random = templatePool[Math.floor(Math.random() * templatePool.length)];
    setCustomMessage(random);
  };

  const quickShare = async () => {
    if (!publicShareLink) return;
    const text = composeShareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "출석 자랑", text, url: publicShareLink });
      } else {
        await navigator.clipboard.writeText(text);
        alert("멘트와 링크를 복사했어요.");
      }
    } catch {
      // user canceled
    }
  };

  const saveImage = async () => {
    if (!data) return;
    try {
      const buildFallbackBlob = () =>
        renderAttendanceShareCard({
          date: data.date,
          didWorkout: data.didWorkout,
          workoutTypes: data.workoutTypes ?? [],
          workoutIntensity: data.workoutIntensity ?? null,
          memo: data.memo ?? null,
          shareComment: customMessage || data.shareComment || null,
          mediaUrl: firstImage,
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
          cheerCount: data.cheerCount,
          showTitle,
          showSubtitle,
          scale: exportScale,
        });

      const isLikelyBlackCanvas = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return false;
        const sampleStepX = Math.max(1, Math.floor(canvas.width / 8));
        const sampleStepY = Math.max(1, Math.floor(canvas.height / 8));
        let blackish = 0;
        let sampled = 0;
        for (let y = 0; y < canvas.height; y += sampleStepY) {
          for (let x = 0; x < canvas.width; x += sampleStepX) {
            const px = ctx.getImageData(x, y, 1, 1).data;
            const luma = px[0] * 0.2126 + px[1] * 0.7152 + px[2] * 0.0722;
            if (luma < 8 && px[3] > 200) blackish += 1;
            sampled += 1;
          }
        }
        return sampled > 0 && blackish / sampled > 0.9;
      };

      const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
      const isMobileOrWebView =
        /android|iphone|ipad|ipod|mobile/.test(ua) ||
        /kakaotalk|instagram|fb_iab|line|naver|wv/.test(ua);

      let blob: Blob;
      const captureNode = previewCaptureRef.current;
      if (captureNode && !isMobileOrWebView) {
        const prevInlineWidth = captureNode.style.width;
        const prevInlineHeight = captureNode.style.height;
        try {
          captureNode.classList.add("exporting");
          if (typeof document !== "undefined" && "fonts" in document) {
            await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
          }
          const rect = captureNode.getBoundingClientRect();
          const captureWidth = Math.max(1, Math.round(rect.width));
          const captureHeight = Math.max(1, Math.round(rect.height));
          captureNode.style.width = `${captureWidth}px`;
          captureNode.style.height = `${captureHeight}px`;
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

          const rawCanvas = await html2canvas(captureNode, {
            backgroundColor: null,
            scale: Math.min(exportScale, 2),
            useCORS: true,
            allowTaint: false,
            width: captureWidth,
            height: captureHeight,
            scrollX: 0,
            scrollY: 0,
            logging: false,
          });
          if (isLikelyBlackCanvas(rawCanvas)) {
            throw new Error("preview capture turned black");
          }

          blob = await new Promise<Blob>((resolve, reject) => {
            rawCanvas.toBlob((file) => {
              if (!file) {
                reject(new Error("이미지 변환에 실패했어요."));
                return;
              }
              resolve(file);
            }, "image/png");
          });
        } catch {
          blob = await buildFallbackBlob();
        } finally {
          captureNode.style.width = prevInlineWidth;
          captureNode.style.height = prevInlineHeight;
          captureNode.classList.remove("exporting");
        }
      } else {
        blob = await buildFallbackBlob();
      }
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = `attendance-card-${data.date}-${exportScale}x.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (e: any) {
      alert(e?.message || "이미지 저장에 실패했어요.");
    }
  };

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
      alert(kind === "cheer" ? "이미 응원했어요." : "이미 신고했어요.");
      return;
    }

    try {
      setSending(true);
      const res = await fetch(`${API_BASE}/api/attendance/share/${data.shareSlug}/${kind}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const payload: ShareData = await res.json();
      setData(payload);
      markReacted(kind);
      if (kind === "report") alert("신고가 접수됐어요.");
    } catch (e: any) {
      alert(e?.message || "처리에 실패했어요.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <section className="attendance-share-page theme-sunset">
        <div className="share-shell">불러오는 중...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="attendance-share-page theme-sunset">
        <div className="share-shell text-red-200">{error || "공유 페이지를 찾을 수 없습니다."}</div>
      </section>
    );
  }

  return (
    <section className={`attendance-share-page theme-${theme}`}>
      <div className="share-orb one" />
      <div className="share-orb two" />

      <div className="share-shell">
        <div className="mb-4">
          <p className="text-xs tracking-[0.25em] uppercase text-white/70">Attendance Brag Studio</p>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2">{title}</h1>
          <p className="text-sm text-white/85 mt-1">
            {data.date} · {data.didWorkout ? "운동 완료" : "휴식 기록"} · 연속 {data.currentStreak ?? 0}일
          </p>
        </div>

        <div className="share-grid">
          <div className="share-panel" aria-label="share preview panel">
            <div ref={previewCaptureRef} className={`share-preview ratio-${ratio}`}>
              {firstImage && (
                <div
                  aria-label="attendance media"
                  className="share-media-bg"
                  style={{
                    backgroundImage: `url("${firstImage}")`,
                    backgroundSize: mediaFit === "cover" ? "cover" : "contain",
                    backgroundPosition: `${mediaPositionX}% ${mediaPositionY}%`,
                    filter: mediaFilter,
                  }}
                />
              )}
              <div className="share-overlay" />
              <div className="share-logo">득근득근</div>
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
                    <span>{activePose.emoji} {activePose.label} · {expressionLabel}</span>
                  </div>
                </div>
              )}

              {ratio === "story" && (
                <>
                  <div className="story-safe top" aria-hidden="true">Story Safe Area</div>
                  <div className="story-safe bottom" aria-hidden="true">Story Safe Area</div>
                </>
              )}

              <div className="share-content">
                <p className="share-attendance-label">Attendance</p>

                <div className="share-badges">
                  {(data.workoutTypes ?? []).slice(0, 3).map((type) => (
                    <span key={type} className="share-badge">{type}</span>
                  ))}
                  {data.workoutIntensity && <span className="share-badge">강도 {data.workoutIntensity}</span>}
                </div>

                <p className={`share-quote quote-${quoteStyle}`}>{customMessage || data.shareComment || data.memo || "오늘 출석 완료!"}</p>

                {showMeta && (
                  <p className="share-meta">응원 {data.cheerCount} · 신고 {data.reportCount} · 득근득근</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/20 p-4 mt-4 text-sm">
              <p className="text-white/80 whitespace-pre-line">{data.memo || "메모 없음"}</p>
            </div>
          </div>

          <div className="share-panel" aria-label="customization controls">
            <div className="control-row">
              <p className="control-title">UI 모드</p>
              <div className="choice-wrap">
                <button className={`choice-btn ${simpleMode ? "active" : ""}`} onClick={() => setSimpleMode(true)}>초간단</button>
                <button className={`choice-btn ${!simpleMode ? "active" : ""}`} onClick={() => setSimpleMode(false)}>전문가</button>
              </div>
            </div>

            {simpleMode && (
              <div className="control-row simple-core-bar">
                <button className="action-btn" onClick={saveImage} aria-label="save custom card quick">커스텀 카드 저장</button>
                <button
                  className={`choice-btn section-toggle compact ${advancedOpen ? "open" : ""}`}
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  aria-expanded={advancedOpen}
                >
                  <span>{advancedOpen ? "더보기 닫기" : "더보기"}</span>
                  <span className="chevron" aria-hidden="true">▾</span>
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
                  <span>Preset</span>
                  <span className="chevron" aria-hidden="true">▾</span>
                </button>
                {isSectionOpen("preset") && (
                  <div className="control-section">
                    <div className="choice-wrap">
                      <button className="choice-btn" onClick={savePreset} aria-label="save preset">현재 설정 저장</button>
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
                <span className="chevron" aria-hidden="true">▾</span>
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
                  <span className="chevron" aria-hidden="true">▾</span>
                </button>
                {isSectionOpen("advancedCard") && (
                  <div className="control-section">
                    <p className="control-subtitle">Theme</p>
                    <div className="choice-wrap">
                      {THEME_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`choice-btn ${theme === option.id ? "active" : ""}`}
                          onClick={() => setTheme(option.id)}
                          aria-label={`theme ${option.label}`}
                          aria-pressed={theme === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">Image Ratio</p>
                    <div className="choice-wrap">
                      {RATIO_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`choice-btn ${ratio === option.id ? "active" : ""}`}
                          onClick={() => setRatio(option.id)}
                          aria-label={`ratio ${option.label}`}
                          aria-pressed={ratio === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">Quote Style</p>
                    <div className="choice-wrap">
                      {QUOTE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`choice-btn ${quoteStyle === option.id ? "active" : ""}`}
                          onClick={() => setQuoteStyle(option.id)}
                          aria-label={`quote style ${option.label}`}
                          aria-pressed={quoteStyle === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">Sticker</p>
                    <div className="choice-wrap">
                      {STICKERS.map((item) => (
                        <button
                          key={item || "none"}
                          className={`choice-btn ${sticker === item ? "active" : ""}`}
                          onClick={() => setSticker(item)}
                          aria-label={`sticker ${item || "none"}`}
                          aria-pressed={sticker === item}
                        >
                          {item || "None"}
                        </button>
                      ))}
                    </div>
                    <p className="control-subtitle mt-3">Export Quality</p>
                    <div className="choice-wrap">
                      {[1, 2, 3].map((scale) => (
                        <button
                          key={scale}
                          className={`choice-btn ${exportScale === scale ? "active" : ""}`}
                          onClick={() => setExportScale(scale as 1 | 2 | 3)}
                          aria-label={`export ${scale}x`}
                          aria-pressed={exportScale === scale}
                        >
                          {scale}x PNG
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input id="meta-toggle" type="checkbox" checked={showMeta} onChange={(e) => setShowMeta(e.target.checked)} aria-label="toggle meta" />
                      <label htmlFor="meta-toggle" className="text-sm text-white/90">응원/공유 메타 표시</label>
                    </div>
                    {previewThumb && (
                      <div className="mt-3">
                        <p className="control-subtitle">Live Thumbnail</p>
                        <img src={previewThumb} alt="share thumbnail preview" className="thumb-preview" />
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
                  <span className="chevron" aria-hidden="true">▾</span>
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
                  <p className="text-xs text-white/65 mt-2">제목/서브텍스트는 카드에서 직접 드래그해서 위치 이동할 수 있어요.</p>
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
                <span className="chevron" aria-hidden="true">▾</span>
              </button>
              {isSectionOpen("photo") && (
                <div className="control-section">
                  <p className="control-subtitle">사진 맞춤</p>
                  <div className="choice-wrap">
                    {MEDIA_FIT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice-btn ${mediaFit === option.id ? "active" : ""}`}
                        onClick={() => setMediaFit(option.id)}
                        aria-label={`media fit ${option.label}`}
                        aria-pressed={mediaFit === option.id}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
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
                  {!firstImage && <p className="text-xs text-white/60 mt-2">사진이 없어서 위치 조절은 비활성화돼요.</p>}

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
                <span className="chevron" aria-hidden="true">▾</span>
              </button>
              {isSectionOpen("character") && (
                <div className="control-section">
                  <div className="choice-wrap">
                    {CHARACTER_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice-btn ${character === option.id ? "active" : ""}`}
                        onClick={() => setCharacter(option.id)}
                        aria-label={`character ${option.label}`}
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
                            aria-label={`pose ${pose.label}`}
                            aria-pressed={characterPose === pose.id}
                          >
                            {pose.emoji} {pose.label}
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
                            {exp.emoji} {exp.label}
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
                    <p className="text-xs text-white/65 mt-2">
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
                  <span className="chevron" aria-hidden="true">▾</span>
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
                  <span>Brag Message</span>
                  <span className="chevron" aria-hidden="true">▾</span>
                </button>
                {isSectionOpen("message") && (
                  <div className="control-section">
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="comment-editor"
                    maxLength={280}
                    placeholder="자랑 멘트를 적어보세요"
                    aria-label="custom brag message"
                  />
                  <div className="choice-wrap mt-2">
                    {templatePool.slice(0, 3).map((template) => (
                      <button key={template} className="choice-btn" onClick={() => setCustomMessage(template)} aria-label="apply template">
                        템플릿
                      </button>
                    ))}
                    <button className="choice-btn" onClick={applyRandomTemplate} aria-label="random recommendation">랜덤 추천</button>
                  </div>
                  <p className="text-xs text-white/70 mt-2">{customMessage.length}/280</p>
                </div>
                )}
              </div>
            )}

            <div className="action-list">
              <button className="action-btn primary" onClick={quickShare} aria-label="quick share">원클릭 공유</button>
              <button className="action-btn" onClick={saveImage} aria-label="save custom card">커스텀 카드 저장</button>
              {showSimpleExtra && (
                <>
                  <button className="action-btn" onClick={async () => { await navigator.clipboard.writeText(composeShareText()); alert("멘트와 링크를 복사했어요."); }} aria-label="copy message and link">
                    멘트+링크 복사
                  </button>
                  <button
                    disabled={sending || hasReacted("cheer")}
                    className="action-btn"
                    onClick={() => sendReaction("cheer")}
                    aria-label="send cheer"
                  >
                    응원하기 {data.cheerCount}
                  </button>
                  <button
                    disabled={sending || hasReacted("report")}
                    className="action-btn"
                    onClick={() => sendReaction("report")}
                    aria-label="report share"
                  >
                    신고하기
                  </button>
                  <a href={appShareLink} className="action-btn" aria-label="refresh current share page">현재 페이지 링크</a>
                  <Link to="/" className="action-btn" aria-label="go home">홈으로</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
