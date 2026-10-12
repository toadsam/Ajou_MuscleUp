import { useEffect, useId, useRef, useState } from "react";
import DialogFrame from "../DialogFrame";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { friendlyError } from "../../lib/httpError";
import { FOOD_DATA_CREDIT, FOOD_SOURCE_LABEL, type PhotoCandidate, type PhotoResult } from "../../lib/foodSearch";

// 사진으로 한 끼 기록(식단 PR C).
// 사진 고르기 → 서버(/api/diet/photo)가 AI 로 음식 · 양을 찾고 영양값은 음식 DB 에서 → 여기서 고르고 고친 뒤 저장(source=PHOTO).
// 사진은 긴 변 1280px JPEG 로 줄여 보낸다(전송량 · 분석 비용, 아이폰 HEIC 도 브라우저가 열 수 있으면 JPEG 로 바뀜). 서버는 사진을 저장하지 않는다.

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

const MEALS: { key: MealType; label: string }[] = [
  { key: "BREAKFAST", label: "아침" },
  { key: "LUNCH", label: "점심" },
  { key: "DINNER", label: "저녁" },
  { key: "SNACK", label: "간식" },
];

const MAX_SIDE = 1280;

const fieldClass =
  "dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";

type Row = {
  checked: boolean;
  name: string;
  grams: string;
  /** matches 의 몇 번째 값을 쓸지, -1 이면 AI 추정값 */
  choice: number;
};

type Nutrition = { kcal: number | null; proteinG: number | null; carbG: number | null; fatG: number | null };

function round1(v: number | null) {
  return v == null ? null : Math.round(v * 10) / 10;
}

/** 고른 값(DB 100g 기준 또는 AI 추정)을 먹은 양에 맞춰 계산 */
function nutritionOf(item: PhotoCandidate, row: Row): Nutrition {
  const g = Number(row.grams);
  if (!Number.isFinite(g) || g <= 0) return { kcal: null, proteinG: null, carbG: null, fatG: null };
  const f = row.choice >= 0 ? item.matches[row.choice] : null;
  if (f) {
    const k = g / 100;
    const s = (v: number | null) => (v == null ? null : v * k);
    return { kcal: s(f.kcal), proteinG: round1(s(f.proteinG)), carbG: round1(s(f.carbG)), fatG: round1(s(f.fatG)) };
  }
  const k = item.grams > 0 ? g / item.grams : 1;
  const s = (v: number | null) => (v == null ? null : v * k);
  return { kcal: s(item.aiKcal), proteinG: round1(s(item.aiProteinG)), carbG: round1(s(item.aiCarbG)), fatG: round1(s(item.aiFatG)) };
}

const fmt = (n: number | null) => (n == null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 사진을 긴 변 MAX_SIDE 의 JPEG 로. 브라우저가 못 여는 형식이면 오류 */
async function toJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("toBlob");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoMealDialog({
  date,
  defaultMeal,
  onClose,
  onSaved,
}: {
  date: string;
  defaultMeal: MealType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyzing" | "saving" | null>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const analyze = async (file: File | undefined) => {
    if (!file || busy) return;
    setError(null);
    setResult(null);
    setRows([]);
    let jpeg: Blob;
    try {
      jpeg = await toJpeg(file);
    } catch {
      setError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 골라 주세요.");
      return;
    }
    setPreview(URL.createObjectURL(jpeg));
    setBusy("analyzing");
    try {
      const form = new FormData();
      form.append("image", jpeg, "meal.jpg");
      const res = await api.post<PhotoResult>("/api/diet/photo", form);
      setResult(res.data);
      setRows(
        res.data.items.map((it) => ({
          checked: true,
          name: it.name.slice(0, 60),
          grams: String(it.grams),
          choice: it.matches.length > 0 ? 0 : -1,
        })),
      );
    } catch (e) {
      setError(friendlyError(e, "사진을 분석하지 못했어요. 잠시 뒤에 다시 시도해 주세요."));
    } finally {
      setBusy(null);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!result || busy) return;
    const picked = rows.map((row, i) => ({ row, item: result.items[i] })).filter(({ row }) => row.checked);
    if (picked.length === 0) {
      setError("저장할 음식을 하나 이상 골라 주세요.");
      return;
    }
    if (picked.some(({ row }) => !row.name.trim())) {
      setError("음식 이름을 적어 주세요.");
      return;
    }
    setBusy("saving");
    setError(null);
    let saved = 0;
    try {
      for (const { row, item } of picked) {
        const n = nutritionOf(item, row);
        const unit = row.choice >= 0 && item.matches[row.choice]?.basis === "100ml" ? "ml" : "g";
        await api.post("/api/diet/entries", {
          date,
          mealType,
          name: row.name.trim(),
          amount: Number(row.grams) > 0 ? `${Math.round(Number(row.grams))}${unit}` : null,
          kcal: n.kcal == null ? null : Math.round(n.kcal),
          proteinG: n.proteinG,
          carbG: n.carbG,
          fatG: n.fatG,
          source: "PHOTO",
        });
        saved++;
      }
      toast(`${saved}개를 기록했어요.`, "success");
      onSaved();
    } catch (e) {
      // 일부만 저장됐으면 그만큼은 남는다 — 몇 개 저장됐는지 알려 준다
      setError(friendlyError(e, saved > 0 ? `${saved}개만 기록했어요. 나머지는 다시 시도해 주세요.` : "기록하지 못했어요."));
      setBusy(null);
      if (saved > 0) onSaved();
    }
  };

  return (
    <DialogFrame
      open
      onClose={onClose}
      busy={busy !== null}
      title="사진으로 기록"
      description="사진 속 음식을 찾아 양과 영양소를 채워 줘요. 저장하기 전에 확인하고 고칠 수 있어요."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="끼니">
          {MEALS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mealType === m.key}
              onClick={() => setMealType(m.key)}
              className={`min-h-[36px] rounded-md border-[3px] border-black px-3 text-sm font-bold ${
                mealType === m.key ? "bg-plate-blue text-white" : "bg-steel-700 text-steel-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy !== null} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">
            사진 찍기
          </button>
          <button type="button" onClick={() => albumRef.current?.click()} disabled={busy !== null} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">
            앨범에서 고르기
          </button>
          {/* 같은 사진을 다시 골라도 change 가 일어나게 value 를 비운다 */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void analyze(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={albumRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void analyze(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-xs text-steel-400">
          사진은 분석에만 쓰고 저장하지 않아요(분석은 OpenAI 가 해요). 하루 {result?.dailyLimit ?? 10}번까지 쓸 수 있어요. AI 는 양을 틀릴 수 있으니 g 을 꼭
          확인해 주세요.
        </p>

        {preview && (
          <img src={preview} alt="고른 음식 사진" className="max-h-48 w-full rounded-md border-2 border-black object-cover" />
        )}

        {busy === "analyzing" && (
          <div className="flex items-center gap-3" role="status">
            <span className="dg-loading-plates" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="text-sm text-steel-300">사진 속 음식을 찾는 중이에요.</span>
          </div>
        )}

        {result && !result.food && (
          <p className="text-sm text-steel-300" role="status">
            사진에서 음식을 찾지 못했어요. 음식이 잘 보이게 다시 찍거나 직접 적어 주세요.
          </p>
        )}

        {result && result.food && (
          <ul className="space-y-3" aria-label="찾은 음식">
            {result.items.map((item, i) => {
              const row = rows[i];
              if (!row) return null;
              const n = nutritionOf(item, row);
              const nameId = `${baseId}-name-${i}`;
              const gramsId = `${baseId}-g-${i}`;
              const choiceId = `${baseId}-c-${i}`;
              return (
                <li key={i} className={`dg-well space-y-2 px-3 py-3 ${row.checked ? "" : "opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => update(i, { checked: e.target.checked })}
                      aria-label={`${row.name || item.name} 기록하기`}
                      className="h-5 w-5 flex-none accent-plate-yellow"
                    />
                    <label htmlFor={nameId} className="sr-only">
                      음식 이름
                    </label>
                    <input id={nameId} value={row.name} maxLength={60} onChange={(e) => update(i, { name: e.target.value })} className={fieldClass} />
                    {item.confidence < 0.5 && (
                      <span className="flex-none rounded-sm bg-plate-yellow px-1.5 text-[11px] font-bold text-black">확인 필요</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label htmlFor={choiceId} className="text-xs font-bold text-steel-300">
                        영양값
                      </label>
                      <select id={choiceId} value={row.choice} onChange={(e) => update(i, { choice: Number(e.target.value) })} className={fieldClass}>
                        {item.matches.map((f, mi) => (
                          <option key={f.id} value={mi}>
                            {FOOD_SOURCE_LABEL[f.source]} · {f.name}
                            {f.maker ? ` · ${f.maker}` : ""} ({f.basis}당 {fmt(f.kcal)}kcal)
                          </option>
                        ))}
                        <option value={-1}>AI 추정값</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={gramsId} className="text-xs font-bold text-steel-300">
                        양(g)
                      </label>
                      <input
                        id={gramsId}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={3000}
                        value={row.grams}
                        onChange={(e) => update(i, { grams: e.target.value })}
                        className={`${fieldClass} font-num`}
                      />
                    </div>
                  </div>
                  <p className="font-num text-xs text-steel-300">
                    {fmt(n.kcal == null ? null : Math.round(n.kcal))} kcal · 단백질 {fmt(n.proteinG)}g · 탄수화물 {fmt(n.carbG)}g · 지방 {fmt(n.fatG)}g
                    <span className="ml-1.5 text-steel-500">{row.choice >= 0 ? "(DB 값)" : "(AI 추정)"}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {result && result.food && !result.catalogReady && (
          <p className="text-xs text-steel-400">음식 목록을 준비하는 중이라 지금은 AI 추정값을 보여 줘요.</p>
        )}
        {result && result.food && <p className="text-[11px] text-steel-500">{FOOD_DATA_CREDIT}</p>}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy !== null} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">
            닫기
          </button>
          {result && result.food && (
            <button type="button" onClick={() => void save()} disabled={busy !== null} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">
              {busy === "saving" ? "기록 중" : `${rows.filter((r) => r.checked).length}개 기록하기`}
            </button>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}
