import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../../lib/api";
import { friendlyError } from "../../lib/httpError";
import { FOOD_DATA_CREDIT, type BarcodeResult, type FoodHit } from "../../lib/foodSearch";

// 음식 추가 창 안의 바코드 칸: 카메라로 포장 바코드를 읽거나 숫자를 직접 넣으면 /api/diet/barcode 로 제품 이름 · 영양값 후보를 받는다.
// 읽기: 브라우저에 BarcodeDetector 가 있으면(안드로이드 Chrome) 그걸, 없으면(아이폰 Safari 등) zxing 을 그때만 불러온다.
// 카메라를 못 쓰면(권한 거절 · 카메라 없음 · http) 숫자 입력만 남는다. 고르면 onPick(영양값까지) · onName(이름만).

const fmt = (n: number | null) => (n == null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(1));

type Props = {
  onPick: (food: FoodHit) => void;
  onName: (name: string) => void;
  onClose: () => void;
};

type Camera = "starting" | "on" | "off";

/** 브라우저 내장 바코드 읽기(타입이 lib.dom 에 아직 없다) */
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? FORMATS;
    const formats = FORMATS.filter((f) => supported.includes(f));
    return formats.length ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

export default function BarcodeScanPanel({ onPick, onName, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<Camera>("starting");
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 카메라를 다시 켤 때마다 바꿔서 읽기 효과를 새로 시작
  const [round, setRound] = useState(0);
  const codeId = useId();

  const lookup = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 14) {
      setError("바코드 아래 숫자 8~14자리를 넣어 주세요.");
      return;
    }
    setCode(digits);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.get<BarcodeResult>(`/api/diet/barcode/${digits}`);
      setResult(res.data);
    } catch (e) {
      setError(friendlyError(e, "바코드를 조회하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }, []);

  // 카메라 켜고 읽기 — 읽으면 카메라를 끄고 조회
  useEffect(() => {
    if (result || busy) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let zxingStop: (() => void) | null = null;

    const found = (value: string) => {
      if (stopped) return;
      stopped = true;
      navigator.vibrate?.(60);
      stop();
      setCamera("off");
      void lookup(value);
    };

    const stop = () => {
      window.clearInterval(timer);
      zxingStop?.();
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("off");
        setCameraNote("이 브라우저에서는 카메라를 쓸 수 없어요. 바코드 아래 숫자를 넣어 주세요.");
        return;
      }
      setCamera("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        if (stopped) return;
        setCamera("off");
        setCameraNote("카메라를 켜지 못했어요(권한을 허용했는지 확인해 주세요). 바코드 아래 숫자를 넣어도 돼요.");
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCamera("on");
      setCameraNote(null);

      const native = await nativeDetector();
      if (stopped) return;
      if (native) {
        let running = false;
        timer = window.setInterval(() => {
          if (running || video.readyState < 2) return;
          running = true;
          native
            .detect(video)
            .then((codes) => {
              const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
              if (hit) found(hit.rawValue);
            })
            .catch(() => undefined)
            .finally(() => {
              running = false;
            });
        }, 250);
        return;
      }
      // 내장 기능이 없으면 zxing(필요할 때만 받는다)
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      if (stopped) return;
      const hints = new Map<number, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
      ]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 });
      const controls = await reader.decodeFromStream(stream, video, (res) => {
        const text = res?.getText();
        if (text && /^\d{8,14}$/.test(text)) found(text);
      });
      zxingStop = () => controls.stop();
      if (stopped) controls.stop();
    })().catch(() => {
      if (stopped) return;
      stop();
      setCamera("off");
      setCameraNote("바코드를 읽을 수 없어요. 바코드 아래 숫자를 넣어 주세요.");
    });

    return () => {
      stopped = true;
      stop();
    };
  }, [round, result, busy, lookup]);

  // 음식 추가 창의 <form> 안에 들어가므로 form 을 겹치지 않고 Enter 를 직접 받는다(겹친 form 은 바깥 form 을 제출해 창이 닫혔다)
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!busy) void lookup(code);
  };

  const again = () => {
    setResult(null);
    setError(null);
    setCode("");
    setRound((r) => r + 1);
  };

  const label = result?.name ?? "";

  return (
    <div className="dg-well space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-chalk">바코드로 찾기</p>
        {/* 창이 열릴 때 숫자 칸 대신 여기로 포커스(휴대폰 키보드가 카메라를 가리지 않게) */}
        <button type="button" onClick={onClose} data-autofocus className="text-xs text-steel-400 underline underline-offset-4">
          닫기
        </button>
      </div>

      {!result && !busy && (
        <div className={camera === "off" ? "hidden" : "relative overflow-hidden rounded-md border-2 border-black bg-black"}>
          <video ref={videoRef} muted playsInline className="block aspect-[4/3] w-full object-cover" aria-label="바코드 카메라" />
          {/* 가운데 가로 줄 — 바코드를 이 안에 맞추게 */}
          <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[28%] -translate-y-1/2 rounded border-[3px] border-plate-yellow" aria-hidden />
          <p className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center text-xs text-steel-200" role="status">
            {camera === "starting" ? "카메라를 켜는 중이에요." : "포장 뒷면 바코드를 노란 칸에 맞춰 주세요."}
          </p>
        </div>
      )}
      {cameraNote && !result && <p className="text-xs text-steel-400">{cameraNote}</p>}

      {!result && (
        <div className="flex gap-2">
          <label htmlFor={codeId} className="sr-only">
            바코드 숫자
          </label>
          <input
            id={codeId}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 14))}
            onKeyDown={onKeyDown}
            inputMode="numeric"
            autoComplete="off"
            placeholder="바코드 숫자 (예: 8801043014809)"
            className="dg-well min-h-[40px] min-w-0 flex-1 px-3 font-num text-sm text-white placeholder:text-steel-500"
          />
          <button type="button" onClick={() => void lookup(code)} disabled={busy || code.length < 8} className="dg-btn dg-btn-steel min-h-[40px] flex-none px-3 text-sm">
            찾기
          </button>
        </div>
      )}

      {busy && (
        <p className="text-sm text-steel-300" role="status">
          바코드 {code} 를 찾는 중이에요.
        </p>
      )}
      {error && (
        <p className="text-sm text-plate-red" role="alert">
          {error}
        </p>
      )}

      {result && !result.found && (
        <div className="space-y-2" role="status">
          <p className="text-sm text-steel-200">
            등록되지 않은 바코드예요 <span className="font-num text-steel-400">({result.barcode})</span>.
          </p>
          <p className="text-xs text-steel-400">작은 회사 · 새 제품 · 수입 제품은 없을 수 있어요. 이름으로 찾거나 포장의 영양정보를 보고 직접 적어 주세요.</p>
          <button type="button" onClick={again} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
            다시 찍기
          </button>
        </div>
      )}

      {result?.found && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-steel-400">
              찾은 제품{result.category ? ` · ${result.category}` : ""} <span className="font-num">({result.barcode})</span>
            </p>
            <p className="font-display text-lg leading-tight text-chalk">{label}</p>
            {result.maker && <p className="text-xs text-steel-300">{result.maker}</p>}
            {result.otherNames.length > 0 && <p className="text-xs text-steel-500">같은 바코드의 다른 이름: {result.otherNames.join(", ")}</p>}
          </div>

          {result.matches.length > 0 ? (
            <>
              <p className="text-xs font-bold text-steel-300">영양 정보를 골라 주세요</p>
              <ul className="space-y-1" aria-label="영양 정보 후보">
                {result.matches.map((f, i) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onPick(f)}
                      className={`w-full rounded px-2 py-1.5 text-left ${i === 0 ? "border-2 border-plate-yellow bg-steel-800" : "border-2 border-transparent hover:bg-steel-700"}`}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-chalk">
                        {i === 0 && <span className="flex-none rounded-sm bg-plate-yellow px-1.5 text-[11px] font-bold text-steel-950">추천</span>}
                        <span className="truncate">
                          {f.name}
                          {f.maker && <span className="ml-1.5 font-normal text-steel-400">{f.maker}</span>}
                        </span>
                      </span>
                      <span className="block font-num text-xs text-steel-400">
                        {f.basis}당 {fmt(f.kcal)}kcal · 단백질 {fmt(f.proteinG)}g · 탄수화물 {fmt(f.carbG)}g · 지방 {fmt(f.fatG)}g
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-steel-500">{FOOD_DATA_CREDIT} · 바코드: 식품의약품안전처 식품안전나라</p>
            </>
          ) : (
            <p className="text-xs text-steel-400">
              {result.catalogReady ? "이 제품의 영양 정보는 아직 없어요." : "음식 목록을 준비하고 있어요."} 이름만 채우고 포장의 영양정보를 보고 적어 주세요.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onName(label)} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
              이름만 채우기
            </button>
            <button type="button" onClick={again} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
              다시 찍기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
