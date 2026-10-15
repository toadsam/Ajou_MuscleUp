import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "../../lib/toast";
import {
  CARD_W,
  cardHeight,
  coverRect,
  drawRunCard,
  loadCardFonts,
  runShareFileName,
  type RunShareData,
  type RunShareOptions,
} from "../../lib/runShareCard";

// 러닝 공유 카드 만들기(전체 화면). 사진 찍기 · 앨범 → 미리보기에서 끌어 위치 맞추기 → 보일 것 켜고 끄기 → 공유 · 저장.
// 공유 파일은 바뀔 때마다 미리 만들어 둔다 — navigator.share 는 누른 직후에만 열려서, 누른 뒤 기다리면 실패한다(CLAUDE.md).

type Props = { data: RunShareData; onClose: () => void };

type WebShareNavigator = Navigator & {
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
};

const TOGGLES: { key: keyof RunShareOptions["show"]; label: string }[] = [
  { key: "distance", label: "거리" },
  { key: "pace", label: "페이스" },
  { key: "time", label: "시간" },
  { key: "route", label: "코스" },
  { key: "date", label: "날짜" },
];

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

export default function RunShareEditor({ data, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const photoUrl = useRef<string | null>(null);
  const drag = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const hasRoute = Boolean(data.route && data.route.length > 1);
  const [opts, setOpts] = useState<RunShareOptions>({
    ratio: "story",
    show: { distance: true, pace: true, time: true, route: hasRoute, date: true },
    place: "bottom",
    ink: "light",
    dim: false,
    photo: null,
    pan: { x: 0, y: 0 },
  });

  useEffect(() => {
    void loadCardFonts().then(() => setFontsReady(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    };
  }, []);

  // 다시 그리고, 공유 파일을 미리 만든다
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !fontsReady) return;
    c.width = CARD_W;
    c.height = cardHeight(opts.ratio);
    const g = c.getContext("2d");
    if (!g) return;
    drawRunCard(g, data, opts);
    let alive = true;
    const t = window.setTimeout(() => {
      c.toBlob(
        (blob) => {
          if (alive && blob) setFile(new File([blob], runShareFileName(data.startedAt), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [data, opts, fontsReady]);

  const pickPhoto = (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    const url = URL.createObjectURL(f);
    photoUrl.current = url;
    const img = new Image();
    img.onload = () => setOpts((o) => ({ ...o, photo: img, pan: { x: 0, y: 0 } }));
    img.onerror = () => toast("사진을 열지 못했어요.", "error");
    img.src = url;
  };

  // 미리보기를 끌어 사진 위치 맞추기
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!opts.photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pan: opts.pan };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    const photo = opts.photo;
    if (!d || !photo) return;
    const scale = CARD_W / e.currentTarget.clientWidth;
    const r = coverRect(photo.naturalWidth, photo.naturalHeight, CARD_W, cardHeight(opts.ratio), d.pan);
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const nx = r.overflowX > 1 ? clamp(d.pan.x - (2 * (e.clientX - d.x) * scale) / r.overflowX) : 0;
    const ny = r.overflowY > 1 ? clamp(d.pan.y - (2 * (e.clientY - d.y) * scale) / r.overflowY) : 0;
    setOpts((o) => ({ ...o, pan: { x: nx, y: ny } }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // 공유: 미리 만든 파일로 곧바로(이 안에서 await 하지 않는다)
  const share = () => {
    const nav = navigator as WebShareNavigator;
    if (file && nav.share && nav.canShare?.({ files: [file] })) {
      nav.share({ files: [file], title: "득근득근 러닝" }).catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") toast("공유하지 못했어요. 이미지 저장을 눌러 주세요.", "error");
      });
      return;
    }
    save();
  };

  const save = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("이미지를 저장했어요", "success");
  };

  const set = <K extends keyof RunShareOptions>(k: K, v: RunShareOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-steel-950 text-white" role="dialog" aria-modal="true" aria-label="러닝 공유 카드 만들기">
      <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
        <h2 className="font-display text-xl">공유 카드</h2>
        <button type="button" onClick={onClose} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm">
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`w-auto max-w-full rounded border-2 border-black shadow-lg ${opts.photo ? "cursor-grab touch-none" : ""}`}
            style={{ height: opts.ratio === "story" ? "min(52vh, 560px)" : "min(42vh, 420px)", aspectRatio: `${CARD_W} / ${cardHeight(opts.ratio)}` }}
            aria-label="공유 카드 미리보기"
          />
          {opts.photo && <p className="-mt-2 text-xs text-steel-400">미리보기를 끌어서 사진 위치를 맞춰요</p>}

          <div className="grid w-full grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="dg-btn dg-btn-primary min-h-[44px]">
              사진 찍기
            </button>
            <button type="button" onClick={() => albumRef.current?.click()} className="dg-btn dg-btn-steel min-h-[44px]">
              앨범에서 고르기
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <input ref={albumRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
          {opts.photo && (
            <button type="button" onClick={() => set("photo", null)} className="-mt-2 text-xs text-steel-400 underline underline-offset-4">
              사진 빼기
            </button>
          )}

          <div className="w-full space-y-3 text-sm">
            <div className="space-y-1.5">
              <p className="text-xs text-steel-400">보일 것</p>
              <div className="flex flex-wrap gap-1.5">
                {TOGGLES.map((t) => (
                  <Chip
                    key={t.key}
                    on={opts.show[t.key]}
                    disabled={t.key === "route" && !hasRoute}
                    onClick={() => set("show", { ...opts.show, [t.key]: !opts.show[t.key] })}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
              {!hasRoute && <p className="text-xs text-steel-500">이 러닝은 이 휴대폰에 코스가 없어요(직접 입력 · 다른 기기).</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs text-steel-400">크기</p>
                <div className="flex gap-1.5">
                  <Chip on={opts.ratio === "story"} onClick={() => set("ratio", "story")}>
                    스토리
                  </Chip>
                  <Chip on={opts.ratio === "post"} onClick={() => set("ratio", "post")}>
                    게시물
                  </Chip>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-steel-400">숫자 위치</p>
                <div className="flex gap-1.5">
                  <Chip on={opts.place === "top"} onClick={() => set("place", "top")}>
                    위
                  </Chip>
                  <Chip on={opts.place === "bottom"} onClick={() => set("place", "bottom")}>
                    아래
                  </Chip>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-steel-400">글자색</p>
                <div className="flex gap-1.5">
                  <Chip on={opts.ink === "light"} onClick={() => set("ink", "light")}>
                    흰색
                  </Chip>
                  <Chip on={opts.ink === "dark"} onClick={() => set("ink", "dark")}>
                    검정
                  </Chip>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-steel-400">사진</p>
                <Chip on={opts.dim} disabled={!opts.photo} onClick={() => set("dim", !opts.dim)}>
                  {opts.ink === "light" ? "어둡게" : "밝게"}
                </Chip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t-2 border-black px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={share} disabled={!file} className="dg-btn dg-btn-primary min-h-[48px] text-base">
          공유하기
        </button>
        <button type="button" onClick={save} disabled={!file} className="dg-btn dg-btn-steel min-h-[48px] text-base">
          이미지 저장
        </button>
      </div>
    </div>
  );
}
