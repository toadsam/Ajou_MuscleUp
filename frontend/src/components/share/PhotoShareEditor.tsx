import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { toast } from "../../lib/toast";
import {
  CARD_W,
  cardHeight,
  coverRect,
  drawPhotoCard,
  loadCardFonts,
  type PhotoCardContent,
  type PhotoCardStyle,
} from "../../lib/photoCard";

// 사진 공유 카드 만들기 — 러닝(전체 화면) · 출석(공유 화면 안)이 같이 쓴다.
// 사진 찍기 · 앨범 → 미리보기를 끌어 위치 맞추기 → 보일 것 켜고 끄기 → 공유 · 저장.
// 공유 파일은 바뀔 때마다 미리 만들어 둔다 — navigator.share 는 누른 직후에만 열려서, 누른 뒤 기다리면 실패한다(CLAUDE.md).

export type ShareToggle = { key: string; label: string; disabled?: boolean };

type Props = {
  toggles: ShareToggle[];
  initialShow: Record<string, boolean>;
  build: (show: Record<string, boolean>) => PhotoCardContent;
  /** 처음 깔 사진(출석 사진 등). 나중에 도착해도 사용자가 아직 안 골랐으면 쓴다 */
  initialPhoto?: HTMLImageElement | null;
  fileName: string;
  shareTitle: string;
  /** 파일 공유가 안 되는 브라우저에서 대신 보낼 링크 */
  fallbackLink?: { text: string; url: string };
  layout: "fullscreen" | "inline";
  onClose?: () => void;
  /** 준비되면 한 번 저장(출석 화면의 "이미지 저장"으로 넘어온 경우) */
  autoSave?: boolean;
  /** 공유 버튼을 눈에 띄게(출석 화면의 "공유"로 넘어온 경우) */
  highlightShare?: boolean;
  note?: ReactNode;
};

type WebShareNavigator = Navigator & {
  share?: (data: { files?: File[]; title?: string; text?: string; url?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
};

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`dg-btn min-h-[36px] px-3 text-xs ${on ? "dg-btn-primary" : "dg-btn-steel"} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export default function PhotoShareEditor(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const photoUrl = useRef<string | null>(null);
  const picked = useRef(false);
  const autoSaved = useRef(false);
  const drag = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [show, setShow] = useState(p.initialShow);
  const [style, setStyle] = useState<PhotoCardStyle>({
    ratio: "story",
    place: "bottom",
    ink: "light",
    dim: false,
    photo: p.initialPhoto ?? null,
    pan: { x: 0, y: 0 },
  });
  const { build, fileName, layout } = p;

  useEffect(() => {
    void loadCardFonts().then(() => setFontsReady(true));
    return () => {
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    };
  }, []);

  // 전체 화면일 때 뒤 화면이 같이 스크롤되지 않게
  useEffect(() => {
    if (layout !== "fullscreen") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [layout]);

  // 처음 사진이 늦게 도착하면(출석 사진 내려받기) 아직 고른 사진이 없을 때만 깐다
  useEffect(() => {
    if (p.initialPhoto && !picked.current) setStyle((s) => ({ ...s, photo: p.initialPhoto ?? null, pan: { x: 0, y: 0 } }));
  }, [p.initialPhoto]);

  // 다시 그리고, 공유 파일을 미리 만든다
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !fontsReady) return;
    c.width = CARD_W;
    c.height = cardHeight(style.ratio);
    const g = c.getContext("2d");
    if (!g) return;
    drawPhotoCard(g, build(show), style);
    let alive = true;
    setFile(null);
    const t = window.setTimeout(() => {
      try {
        c.toBlob(
          (blob) => {
            if (alive && blob) setFile(new File([blob], fileName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.92,
        );
      } catch {
        // 다른 주소 사진이라 캔버스가 막힘 — 사진을 다시 골라 달라고 한다
        toast("이 사진으로는 카드를 만들 수 없어요. 앨범에서 다시 골라 주세요.", "error");
      }
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [build, show, style, fontsReady, fileName]);

  const pickPhoto = (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    const url = URL.createObjectURL(f);
    photoUrl.current = url;
    const img = new Image();
    img.onload = () => {
      picked.current = true;
      setStyle((s) => ({ ...s, photo: img, pan: { x: 0, y: 0 } }));
    };
    img.onerror = () => toast("사진을 열지 못했어요.", "error");
    img.src = url;
  };

  // 미리보기를 끌어 사진 위치 맞추기
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!style.photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pan: style.pan };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    const photo = style.photo;
    if (!d || !photo) return;
    const scale = CARD_W / e.currentTarget.clientWidth;
    const r = coverRect(photo.naturalWidth, photo.naturalHeight, CARD_W, cardHeight(style.ratio), d.pan);
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const nx = r.overflowX > 1 ? clamp(d.pan.x - (2 * (e.clientX - d.x) * scale) / r.overflowX) : 0;
    const ny = r.overflowY > 1 ? clamp(d.pan.y - (2 * (e.clientY - d.y) * scale) / r.overflowY) : 0;
    setStyle((s) => ({ ...s, pan: { x: nx, y: ny } }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const save = (silent = false) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (!silent) toast("이미지를 저장했어요", "success");
  };

  // 출석 화면에서 "이미지 저장"으로 넘어오면 준비되는 대로 한 번 저장(다운로드는 누름 없이도 된다)
  useEffect(() => {
    if (!p.autoSave || !file || autoSaved.current) return;
    autoSaved.current = true;
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.autoSave, file]);

  // 공유: 미리 만든 파일로 곧바로(이 안에서 await 하지 않는다)
  const share = () => {
    const nav = navigator as WebShareNavigator;
    if (file && nav.share && nav.canShare?.({ files: [file] })) {
      nav.share({ files: [file], title: p.shareTitle }).catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") toast("공유하지 못했어요. 이미지 저장을 눌러 주세요.", "error");
      });
      return;
    }
    if (p.fallbackLink && nav.share) {
      nav.share({ title: p.shareTitle, text: p.fallbackLink.text, url: p.fallbackLink.url }).catch(() => undefined);
      return;
    }
    // 공유 창이 없는 브라우저(대부분의 PC): 저장 + 링크 복사
    save(true);
    if (p.fallbackLink) void navigator.clipboard?.writeText(`${p.fallbackLink.text} ${p.fallbackLink.url}`).catch(() => undefined);
    toast(p.fallbackLink ? "공유 창이 없는 브라우저라 이미지를 저장하고 링크를 복사했어요." : "공유 창이 없는 브라우저라 이미지를 저장했어요.");
  };

  const set = <K extends keyof PhotoCardStyle>(k: K, v: PhotoCardStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));

  const body = (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`w-auto max-w-full rounded border-2 border-black shadow-lg ${style.photo ? "cursor-grab touch-none" : ""}`}
        style={{ height: style.ratio === "story" ? "min(52vh, 560px)" : "min(42vh, 420px)", aspectRatio: `${CARD_W} / ${cardHeight(style.ratio)}` }}
        aria-label="공유 카드 미리보기"
      />
      {style.photo && <p className="-mt-2 text-xs text-steel-400">미리보기를 끌어서 사진 위치를 맞춰요</p>}

      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraRef.current?.click()} className="dg-btn dg-btn-steel min-h-[44px]">
          사진 찍기
        </button>
        <button type="button" onClick={() => albumRef.current?.click()} className="dg-btn dg-btn-steel min-h-[44px]">
          앨범에서 고르기
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        <input ref={albumRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
      </div>
      {style.photo && (
        <button
          type="button"
          onClick={() => {
            picked.current = true;
            set("photo", null);
          }}
          className="-mt-2 text-xs text-steel-400 underline underline-offset-4"
        >
          사진 빼기
        </button>
      )}

      <div className="w-full space-y-3 text-sm">
        <div className="space-y-1.5">
          <p className="text-xs text-steel-400">보일 것</p>
          <div className="flex flex-wrap gap-1.5">
            {p.toggles.map((t) => (
              <Chip key={t.key} on={Boolean(show[t.key]) && !t.disabled} disabled={t.disabled} onClick={() => setShow((v) => ({ ...v, [t.key]: !v[t.key] }))}>
                {t.label}
              </Chip>
            ))}
          </div>
          {p.note}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs text-steel-400">크기</p>
            <div className="flex gap-1.5">
              <Chip on={style.ratio === "story"} onClick={() => set("ratio", "story")}>
                스토리
              </Chip>
              <Chip on={style.ratio === "post"} onClick={() => set("ratio", "post")}>
                게시물
              </Chip>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-steel-400">숫자 위치</p>
            <div className="flex gap-1.5">
              <Chip on={style.place === "top"} onClick={() => set("place", "top")}>
                위
              </Chip>
              <Chip on={style.place === "bottom"} onClick={() => set("place", "bottom")}>
                아래
              </Chip>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-steel-400">글자색</p>
            <div className="flex gap-1.5">
              <Chip on={style.ink === "light"} onClick={() => set("ink", "light")}>
                흰색
              </Chip>
              <Chip on={style.ink === "dark"} onClick={() => set("ink", "dark")}>
                검정
              </Chip>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-steel-400">사진</p>
            <Chip on={style.dim} disabled={!style.photo} onClick={() => set("dim", !style.dim)}>
              {style.ink === "light" ? "어둡게" : "밝게"}
            </Chip>
          </div>
        </div>
      </div>
    </div>
  );

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={share}
        disabled={!file}
        className={`dg-btn dg-btn-primary min-h-[48px] text-base ${p.highlightShare && file ? "dg-pop" : ""}`}
      >
        {file ? "공유하기" : "만드는 중…"}
      </button>
      <button type="button" onClick={() => save()} disabled={!file} className="dg-btn dg-btn-steel min-h-[48px] text-base">
        이미지 저장
      </button>
    </div>
  );

  if (layout === "inline") {
    return (
      <div className="space-y-4">
        {body}
        <div className="mx-auto max-w-md">{actions}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-steel-950 text-white" role="dialog" aria-modal="true" aria-label="공유 카드 만들기">
      <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
        <h2 className="font-display text-xl">공유 카드</h2>
        <button type="button" onClick={p.onClose} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm">
          닫기
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">{body}</div>
      <div className="border-t-2 border-black px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">{actions}</div>
    </div>
  );
}
