import { useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type InbodyResponse = {
  consultation: string;
  metrics: Record<string, string>;
  targets: Record<string, string>;
  dailyNutrition: Record<string, string>;
  weeklyCheckpoints: Array<Record<string, string>>;
  goalSource?: "AUTO" | "USER" | "USER_CONFIRMED" | string;
  confidence: number;
  reviewRequired: boolean;
  warnings: string[];
  sourceType: string;
};

type ProfileGender = "MALE" | "FEMALE";

type ConsultationSection = {
  key: string;
  title: string;
  content: string;
};

const CORE_KEYS = ["weight_kg", "skeletal_muscle_kg", "body_fat_percent", "visceral_fat_level"] as const;

const metricLabels: Record<string, string> = {
  height_cm: "키 (cm)",
  weight_kg: "체중 (kg)",
  skeletal_muscle_kg: "골격근량 (kg)",
  body_fat_kg: "체지방량 (kg)",
  body_fat_percent: "체지방률 (%)",
  bmi: "BMI",
  bmr_kcal: "기초대사량 (kcal)",
  visceral_fat_level: "내장지방 레벨",
  inbody_score: "인바디 점수",
};

const goalIntensityOptions = [
  { value: "conservative", label: "보수적" },
  { value: "standard", label: "표준" },
  { value: "aggressive", label: "공격적" },
] as const;

const sectionRules: Array<{ key: string; title: string; keywords: string[] }> = [
  { key: "current", title: "현재 상태", keywords: ["현재", "요약", "분석", "체성", "상태"] },
  { key: "goal", title: "목표 설정", keywords: ["목표", "감량", "증량", "12주", "4주"] },
  { key: "nutrition", title: "식단/영양", keywords: ["식단", "영양", "탄수", "단백", "지방", "칼로리", "섭취"] },
  { key: "exercise", title: "운동 계획", keywords: ["운동", "루틴", "유산소", "근력", "세트", "반복"] },
  { key: "checkpoint", title: "체크포인트", keywords: ["체크", "주차", "측정", "점검"] },
  { key: "caution", title: "주의사항", keywords: ["주의", "경고", "리스크", "위험", "통증", "어지럼"] },
];

const nutritionColors = ["#38bdf8", "#22c55e", "#f59e0b"];
const MIN_SECTION_DIGEST_ITEMS = 3;
const MAX_SECTION_DIGEST_ITEMS = 4;
const workflowCards = [
  { step: "Step 01", title: "인바디 업로드", desc: "사진/PDF를 올리고 OCR 추출을 시작합니다." },
  { step: "Step 02", title: "목표/강도 설정", desc: "감량/증량 방향과 난이도를 지정합니다." },
  { step: "Step 03", title: "상담 리포트 확인", desc: "차트 분석과 주차별 가이드를 확인합니다." },
] as const;
const consultModes = [
  { value: "upload", label: "파일 업로드 상담", desc: "인바디 이미지/PDF로 분석합니다." },
  { value: "manual", label: "직접 입력 상담", desc: "수치를 직접 넣고 바로 상담합니다." },
] as const;

export default function InbodyConsult() {
  const [consultMode, setConsultMode] = useState<(typeof consultModes)[number]["value"]>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [goalIntensity, setGoalIntensity] = useState<(typeof goalIntensityOptions)[number]["value"]>("standard");
  const [profileGender, setProfileGender] = useState<ProfileGender | "">("");
  const [profileAge, setProfileAge] = useState("");
  const [profileHeightCm, setProfileHeightCm] = useState("");
  const [manualMetrics, setManualMetrics] = useState<Record<string, string>>({
    height_cm: "",
    weight_kg: "",
    skeletal_muscle_kg: "",
    body_fat_kg: "",
    body_fat_percent: "",
    bmi: "",
    bmr_kcal: "",
    visceral_fat_level: "",
    inbody_score: "",
  });
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InbodyResponse | null>(null);
  const [confirmedMetrics, setConfirmedMetrics] = useState<Record<string, string>>({});
  const [reviewGoal, setReviewGoal] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const captureRef = useRef<HTMLDivElement | null>(null);

  const compositionData = useMemo(() => {
    if (!result) return [];
    return [
      { name: "체중", current: toNumber(result.metrics.weight_kg), target: toNumber(result.targets.target_weight_kg) },
      { name: "골격근량", current: toNumber(result.metrics.skeletal_muscle_kg), target: toNumber(result.targets.target_skeletal_muscle_kg) },
      { name: "체지방량", current: toNumber(result.metrics.body_fat_kg), target: toNumber(result.targets.target_body_fat_kg) },
    ];
  }, [result]);

  const weeklyData = useMemo(() => {
    if (!result) return [];
    return (result.weeklyCheckpoints || []).map((row, idx) => ({
      week: `W${row.week || idx + 1}`,
      weight: toNumber(row.target_weight_kg),
      fat: toNumber(row.target_body_fat_kg),
      focus: row.focus || "",
    }));
  }, [result]);

  const macroData = useMemo(() => {
    if (!result) return [];
    return [
      { name: "탄수화물", grams: toNumber(result.dailyNutrition.carb_g), ratio: toNumber(result.dailyNutrition.carb_ratio_percent) },
      { name: "단백질", grams: toNumber(result.dailyNutrition.protein_g), ratio: toNumber(result.dailyNutrition.protein_ratio_percent) },
      { name: "지방", grams: toNumber(result.dailyNutrition.fat_g), ratio: toNumber(result.dailyNutrition.fat_ratio_percent) },
    ].filter((x) => x.ratio > 0 || x.grams > 0);
  }, [result]);

  const macroGuide = useMemo(() => {
    if (!result) return null;
    const carb = toNumber(result.dailyNutrition.carb_g);
    const protein = toNumber(result.dailyNutrition.protein_g);
    const fat = toNumber(result.dailyNutrition.fat_g);
    return {
      calories: toNumber(result.dailyNutrition.calories_kcal),
      carb,
      protein,
      fat,
      carbPerMeal: round1(carb / 3),
      proteinPerMeal: round1(protein / 3),
      fatPerMeal: round1(fat / 3),
    };
  }, [result]);

  const normalizedConsultation = useMemo(() => {
    if (!result) return "";
    return normalizeConsultation(result);
  }, [result]);

  const consultationSections = useMemo(() => {
    return result ? buildConsultationSections(normalizedConsultation) : [];
  }, [result, normalizedConsultation]);

  const summaryLines = useMemo(() => buildKeySummaryLines(normalizedConsultation, consultationSections, 3), [normalizedConsultation, consultationSections]);
  const beginnerHighlights = useMemo(() => (result ? buildBeginnerHighlights(result) : []), [result]);
  const actionChecklist = useMemo(() => (result ? buildActionChecklist(result) : []), [result]);
  const metricInsightCards = useMemo(
    () =>
      result
        ? buildMetricInsightCards(result.metrics, {
            gender: profileGender,
            age: toNumber(profileAge),
            heightCm: toNumber(profileHeightCm),
          })
        : [],
    [result, profileGender, profileAge, profileHeightCm]
  );
  const personalInterpretation = useMemo(
    () =>
      result
        ? buildPersonalMetricSummaries(result.metrics, {
            gender: profileGender,
            age: toNumber(profileAge),
            heightCm: toNumber(profileHeightCm),
          })
        : [],
    [result, profileGender, profileAge, profileHeightCm]
  );

  const compositionDomain = useMemo(() => {
    const values = compositionData.flatMap((x) => [x.current, x.target]);
    return buildDomain(values, 5);
  }, [compositionData]);

  const weeklyDomain = useMemo(() => {
    const values = weeklyData.flatMap((x) => [x.weight, x.fat]);
    return buildDomain(values, 4);
  }, [weeklyData]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (consultMode === "manual") {
      await submitManualConsult();
      return;
    }
    if (!file) {
      setError("인바디 사진 또는 PDF 파일을 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (goal.trim()) formData.append("goal", goal.trim());
      if (notes.trim()) formData.append("notes", notes.trim());
      formData.append("goalIntensity", goalIntensity);
      if (profileGender) formData.append("gender", profileGender);
      if (profileAge.trim()) formData.append("age", profileAge.trim());
      if (profileHeightCm.trim()) formData.append("heightCm", profileHeightCm.trim());

      const res = await fetch(`${API_BASE}/api/ai/inbody/consult`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = (await res.json()) as InbodyResponse;
      setResult(data);
      setConfirmedMetrics(extractCoreMetrics(data.metrics));
    } catch (err: any) {
      setError(err?.message ?? "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submitManualConsult = async () => {
    const cleanedMetrics = Object.fromEntries(
      Object.entries(manualMetrics)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value.length > 0)
    );

    const requiredKeys = ["weight_kg", "skeletal_muscle_kg", "body_fat_percent", "visceral_fat_level"];
    const missingRequired = requiredKeys.filter((key) => !cleanedMetrics[key]);
    if (missingRequired.length > 0) {
      setError("직접 입력 상담은 체중, 골격근량, 체지방률, 내장지방 레벨을 먼저 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/inbody/review-consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metrics: cleanedMetrics,
          goal,
          notes,
          goalIntensity,
          gender: profileGender || null,
          age: parseOptionalInt(profileAge),
          heightCm: parseOptionalInt(profileHeightCm),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = (await res.json()) as InbodyResponse;
      setResult(data);
      setConfirmedMetrics(extractCoreMetrics(data.metrics));
    } catch (err: any) {
      setError(err?.message ?? "직접 입력 상담 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const rerunWithConfirmedMetrics = async () => {
    if (!result) return;
    setReviewLoading(true);
    setError(null);
    try {
      const nextGoal = reviewGoal.trim() || goal.trim();
      const nextNotes = reviewNotes.trim() || notes.trim();
      const res = await fetch(`${API_BASE}/api/ai/inbody/review-consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metrics: { ...result.metrics, ...confirmedMetrics },
          goal: nextGoal,
          notes: nextNotes,
          goalIntensity,
          gender: profileGender || null,
          age: parseOptionalInt(profileAge),
          heightCm: parseOptionalInt(profileHeightCm),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = (await res.json()) as InbodyResponse;
      setResult(data);
      setConfirmedMetrics(extractCoreMetrics(data.metrics));
    } catch (err: any) {
      setError(err?.message ?? "재상담 중 오류가 발생했습니다.");
    } finally {
      setReviewLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!result) return;
    setPdfLoading(true);
    setError(null);
    let exportTarget: HTMLDivElement | null = null;
    let exportStyleEl: HTMLStyleElement | null = null;
    let fullRawPrevState: boolean[] = [];
    try {
      const target = captureRef.current;
      if (!target) throw new Error("PDF 캡처 대상을 찾지 못했습니다.");
      exportTarget = target;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      let cursorY = margin;

      const styleEl = document.createElement("style");
      styleEl.innerHTML = `
        [data-pdf-capture="true"][data-pdf-exporting="1"] {
          max-width: 920px !important;
          margin: 0 auto !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
          background: #020617 !important;
        }
        [data-pdf-capture="true"][data-pdf-exporting="1"] [class*="sm:grid-cols-2"],
        [data-pdf-capture="true"][data-pdf-exporting="1"] [class*="sm:grid-cols-3"],
        [data-pdf-capture="true"][data-pdf-exporting="1"] [class*="md:grid-cols-2"],
        [data-pdf-capture="true"][data-pdf-exporting="1"] [class*="md:grid-cols-3"],
        [data-pdf-capture="true"][data-pdf-exporting="1"] [class*="lg:grid-cols-"] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        [data-pdf-capture="true"][data-pdf-exporting="1"] details.ai-raw-snippet {
          display: none !important;
        }
        [data-pdf-capture="true"][data-pdf-exporting="1"] details.ai-full-raw > summary {
          display: none !important;
        }
        [data-pdf-capture="true"][data-pdf-exporting="1"] details.ai-full-raw {
          display: block !important;
        }
        [data-pdf-capture="true"][data-pdf-exporting="1"] details.ai-full-raw pre {
          margin-top: 0 !important;
          white-space: pre-wrap !important;
          word-break: keep-all !important;
        }
      `;
      document.head.appendChild(styleEl);
      exportStyleEl = styleEl;
      target.setAttribute("data-pdf-exporting", "1");
      const fullRawDetails = Array.from(target.querySelectorAll<HTMLDetailsElement>("details.ai-full-raw"));
      fullRawPrevState = fullRawDetails.map((d) => d.open);
      fullRawDetails.forEach((d) => {
        d.open = true;
      });
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

      const blocks = Array.from(
        target.querySelectorAll<HTMLElement>('[data-pdf-block="1"]')
      ).filter((el) => !el.parentElement?.closest('[data-pdf-block="1"]'));

      const captureNodes = blocks.length > 0 ? blocks : [target];

      for (const node of captureNodes) {
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#020617",
          logging: false,
        });

        const blockHeightMm = (canvas.height * contentWidth) / canvas.width;
        const gap = 3;

        if (blockHeightMm <= contentHeight) {
          if (cursorY + blockHeightMm > margin + contentHeight) {
            pdf.addPage();
            cursorY = margin;
          }
          const imgData = canvas.toDataURL("image/png");
          pdf.addImage(imgData, "PNG", margin, cursorY, contentWidth, blockHeightMm, undefined, "FAST");
          cursorY += blockHeightMm + gap;
          continue;
        }

        // Oversized blocks are sliced as a fallback.
        const remainingMm = margin + contentHeight - cursorY;
        const remainingSlicePx = Math.floor((remainingMm * canvas.width) / contentWidth);
        const fullSlicePx = Math.floor((contentHeight * canvas.width) / contentWidth);
        let offset = 0;
        let firstSlice = true;
        while (offset < canvas.height) {
          const targetSlicePx = firstSlice && remainingSlicePx > 120 ? remainingSlicePx : fullSlicePx;
          const sliceHeight = Math.min(targetSlicePx, canvas.height - offset);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext("2d");
          if (!ctx) throw new Error("PDF 캔버스 렌더링에 실패했습니다.");
          ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

          const imgData = pageCanvas.toDataURL("image/png");
          const imgHeightMm = (sliceHeight * contentWidth) / canvas.width;

          if (!firstSlice || cursorY + imgHeightMm > margin + contentHeight) {
            pdf.addPage();
            cursorY = margin;
          }
          pdf.addImage(imgData, "PNG", margin, cursorY, contentWidth, imgHeightMm, undefined, "FAST");
          cursorY += imgHeightMm + 1.5;
          offset += sliceHeight;
          firstSlice = false;
        }
      }

      pdf.save(`inbody-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      setError(err?.message ?? "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      if (exportTarget) {
        const fullRawDetails = Array.from(exportTarget.querySelectorAll<HTMLDetailsElement>("details.ai-full-raw"));
        fullRawDetails.forEach((d, idx) => {
          d.open = fullRawPrevState[idx] ?? false;
        });
      }
      if (exportTarget) exportTarget.removeAttribute("data-pdf-exporting");
      if (exportStyleEl) exportStyleEl.remove();
      setPdfLoading(false);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-6 pb-20 pt-28 text-slate-100 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-16 top-48 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>
      <div ref={captureRef} data-pdf-capture="true" className="relative mx-auto max-w-6xl space-y-6">
        <div data-pdf-block="1" className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-cyan-950/40 p-6 shadow-[0_20px_70px_-30px_rgba(34,211,238,0.55)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
          <p className="relative inline-flex rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            AI InBody Studio
          </p>
          <h1 className="relative mt-3 text-3xl font-bold leading-tight md:text-4xl">인바디 AI 상담 대시보드</h1>
          <p className="relative mt-3 max-w-3xl text-sm text-slate-200 md:text-base">OCR 추출, 핵심 수치 재확인, 맞춤 상담과 차트, PDF 보고서까지 한 화면에서 빠르게 처리합니다.</p>
          <div className="relative mt-5 grid gap-3 md:grid-cols-3">
            {workflowCards.map((card) => (
              <div key={card.step} className="rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90">{card.step}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{card.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <form
          data-pdf-block="1"
          onSubmit={onSubmit}
          className="grid gap-4 rounded-3xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-[0_20px_70px_-40px_rgba(2,132,199,0.5)] backdrop-blur md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <p className="text-sm">상담 시작 방식</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {consultModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setConsultMode(mode.value)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    consultMode === mode.value
                      ? "border-cyan-300/60 bg-cyan-500/10 shadow-[0_0_30px_-18px_rgba(34,211,238,0.9)]"
                      : "border-slate-700 bg-slate-950/50 hover:border-cyan-300/35"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-100">{mode.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <label className="block text-sm">
              성별(선택)
              <select
                value={profileGender}
                onChange={(e) => setProfileGender(e.target.value as ProfileGender | "")}
                className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm focus:border-cyan-300/60 focus:outline-none"
              >
                <option value="">선택 안 함</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </label>
            <label className="block text-sm">
              나이(선택)
              <input
                type="number"
                min={0}
                max={120}
                value={profileAge}
                onChange={(e) => setProfileAge(e.target.value)}
                placeholder="예: 29"
                className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              키(cm, 선택)
              <input
                type="number"
                min={0}
                max={250}
                value={profileHeightCm}
                onChange={(e) => setProfileHeightCm(e.target.value)}
                placeholder="예: 170"
                className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              />
            </label>
          </div>

          {consultMode === "upload" ? (
            <label className="block text-sm">
              인바디 파일 (이미지/PDF)
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-cyan-400/90 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-950 hover:border-cyan-300/40"
              />
              <p className="mt-1 text-xs text-slate-400">{file?.name ? `선택 파일: ${file.name}` : "선택된 파일 없음"}</p>
            </label>
          ) : (
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["height_cm", "키 (cm)"],
                ["weight_kg", "체중 (kg)"],
                ["skeletal_muscle_kg", "골격근량 (kg)"],
                ["body_fat_kg", "체지방량 (kg)"],
                ["body_fat_percent", "체지방률 (%)"],
                ["bmi", "BMI"],
                ["bmr_kcal", "기초대사량 (kcal)"],
                ["visceral_fat_level", "내장지방 레벨"],
                ["inbody_score", "인바디 점수"],
              ].map(([key, label]) => (
                <label key={key} className="block text-sm">
                  {label}
                  <input
                    type="text"
                    value={manualMetrics[key] || ""}
                    onChange={(e) => setManualMetrics((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={key === "weight_kg" ? "예: 55.2" : "직접 입력"}
                    className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          )}

          <label className="block text-sm">
            목표
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: 12주 동안 체지방 8kg 감량"
              className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">비워두면 AI가 자동 목표를 추천합니다.</p>
          </label>

          <div className="md:col-span-2">
            <p className="text-sm">목표 강도</p>
            <div className="mt-2 flex gap-2">
              {goalIntensityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGoalIntensity(opt.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    goalIntensity === opt.value
                      ? "bg-gradient-to-r from-emerald-400 to-cyan-300 text-slate-900 shadow-[0_0_24px_-12px_rgba(16,185,129,0.95)]"
                      : "border border-slate-600 text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm md:col-span-2">
            추가 메모
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 주 4회 운동 가능, 무릎 부담 운동은 피하고 싶음"
              className="mt-2 block w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
            />
          </label>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-300 px-5 py-2.5 font-semibold text-slate-950 shadow-[0_0_30px_-14px_rgba(34,197,94,0.85)] transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "AI 상담 중..." : consultMode === "upload" ? "분석 시작" : "직접 입력 상담 시작"}
            </button>
            {result && (
              <button
                type="button"
                onClick={exportPdf}
                disabled={pdfLoading}
                className="rounded-xl border border-cyan-300/35 bg-cyan-500/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-60"
              >
                {pdfLoading ? "PDF 생성 중..." : "PDF 다운로드"}
              </button>
            )}
          </div>
          <p className="md:col-span-2 text-xs text-slate-400">의료 진단이 아닌 운동/영양 코칭 참고 자료입니다.</p>
        </form>

        {error && <div data-pdf-block="1" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        {!result && (
          <div data-pdf-block="1" className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 md:p-8">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(56,189,248,0.22),rgba(15,23,42,0)_58%)]" />
            <h3 className="text-xl font-semibold text-slate-100">상담 시작 전 안내</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              인바디 원본 수치가 잘 보이는 이미지나 PDF를 올리면 정확도가 올라갑니다. 목표를 구체적으로 작성할수록 상담 카드 품질이 좋아집니다.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">파일 권장: 정면 촬영, 그림자 최소화</div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">목표 예시: 8주 체지방률 3%p 감량</div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">결과 제공: 차트 + 주차별 목표 + PDF</div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-5">
            <div data-pdf-block="1" className="flex flex-wrap items-center gap-3">
              <Badge label={`신뢰도 ${result.confidence}%`} />
              <Badge label={`입력 형식: ${result.sourceType}`} />
              <Badge label={`목표 출처: ${goalSourceLabel(result.goalSource)}`} />
              {result.reviewRequired && <Badge label="수치 확인 필요" warning />}
            </div>

            <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-900 p-6 shadow-[0_18px_50px_-30px_rgba(34,211,238,0.65)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Beginner Friendly Summary</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-50">한눈에 보는 현재 상태와 다음 액션</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  아래 카드만 읽어도 지금 상태, 우선순위, 식단/운동 방향을 빠르게 이해할 수 있게 정리했습니다.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {beginnerHighlights.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-cyan-300/20 bg-slate-950/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/85">{item.eyebrow}</p>
                      <p className="mt-1 text-base font-semibold text-slate-50">{item.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Quick Actions</p>
                <h3 className="mt-2 text-xl font-bold text-slate-50">초보자용 실행 체크리스트</h3>
                <div className="mt-4 space-y-3">
                  {actionChecklist.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="flex gap-3 rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-4">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 font-bold text-slate-950">
                        {idx + 1}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div data-pdf-block="1" className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5">
              <h3 className="text-sm font-semibold text-amber-100">입력값 재확인 (핵심 4개)</h3>
              <p className="mt-1 text-xs text-amber-50">오인식이 의심되면 수정 후 재상담을 눌러 주세요.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CORE_KEYS.map((key) => (
                  <label key={key} className="text-xs text-slate-100">
                    {metricLabels[key]}
                    <input
                      type="text"
                      value={confirmedMetrics[key] || ""}
                      onChange={(e) => setConfirmedMetrics((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-amber-200/20 bg-slate-900/90 px-2 py-2 text-sm focus:border-amber-300/60 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-amber-50">
                  재상담 목표 (선택)
                  <input
                    type="text"
                    value={reviewGoal}
                    onChange={(e) => setReviewGoal(e.target.value)}
                    placeholder={goal || "예: 체지방 감량 + 근육량 유지"}
                    className="mt-1 w-full rounded-lg border border-amber-200/20 bg-slate-900/90 px-2 py-2 text-sm focus:border-amber-300/60 focus:outline-none"
                  />
                </label>
                <label className="text-xs text-amber-50">
                  재상담 추가 메모 (선택)
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={notes || "예: 식단은 현실적으로 간단하게"}
                    className="mt-1 w-full rounded-lg border border-amber-200/20 bg-slate-900/90 px-2 py-2 text-sm focus:border-amber-300/60 focus:outline-none"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={rerunWithConfirmedMetrics}
                disabled={reviewLoading}
                className="mt-3 rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-200 disabled:opacity-60"
              >
                {reviewLoading ? "재상담 중..." : "확정값으로 재상담"}
              </button>
            </div>

            <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-3">
              {metricInsightCards.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-[0_14px_40px_-28px_rgba(34,211,238,0.65)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-50">{item.value}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.toneClass}`}>{item.badge}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-100">{item.headline}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>

            {personalInterpretation.length > 0 && (
              <div data-pdf-block="1" className="rounded-2xl border border-cyan-300/30 bg-cyan-500/5 p-5">
                <h3 className="text-sm font-semibold text-cyan-100">개인 기준 해석 요약</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-cyan-50">
                  {personalInterpretation.map((line, idx) => (
                    <li key={`${line}-${idx}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div data-pdf-block="1" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metricLabels).map(([key, label]) => (
                <MetricCard key={key} label={label} value={result.metrics?.[key] || "-"} />
              ))}
            </div>

            <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="현재 vs 목표 (고정 축)">
                <p className="mb-3 text-sm leading-relaxed text-slate-300">
                  파란 막대는 현재, 초록 막대는 목표입니다. 두 막대 차이가 클수록 우선적으로 조정해야 할 항목입니다.
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compositionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#cbd5e1" />
                      <YAxis stroke="#cbd5e1" domain={compositionDomain} />
                      <Tooltip formatter={(v: any) => `${v}`} />
                      <Legend />
                      <Bar dataKey="current" name="현재" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="target" name="목표" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="탄단지 비율">
                <p className="mb-3 text-sm leading-relaxed text-slate-300">
                  식단을 숫자로 보기 어렵다면 이 원형 차트만 보셔도 됩니다. 비율이 너무 한쪽으로 치우치면 식단 균형을 다시 잡는 게 좋습니다.
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={macroData} dataKey="ratio" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>
                        {macroData.map((_, idx) => (
                          <Cell key={idx} fill={nutritionColors[idx % nutritionColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {macroGuide && (
                  <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm">
                    <p className="font-semibold text-slate-100">하루 권장 섭취량</p>
                    <p className="mt-1 text-slate-200">
                      총 {macroGuide.calories} kcal
                      {" | "}탄수화물 {macroGuide.carb}g
                      {" | "}단백질 {macroGuide.protein}g
                      {" | "}지방 {macroGuide.fat}g
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      1일 3끼 기준(대략): 탄수화물 {macroGuide.carbPerMeal}g / 단백질 {macroGuide.proteinPerMeal}g / 지방 {macroGuide.fatPerMeal}g
                    </p>
                  </div>
                )}
              </ChartCard>
            </div>

            <div data-pdf-block="1">
            <ChartCard title="주차별 목표 추이 (고정 축)">
              <p className="mb-3 text-sm leading-relaxed text-slate-300">
                주차별로 체중과 체지방량이 어떻게 변해야 하는지 보여줍니다. 급격한 하락보다 꾸준한 하락이 더 안정적인 계획입니다.
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" domain={weeklyDomain} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="weight" name="목표 체중" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="fat" name="목표 체지방량" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            </div>

            {result.warnings?.length > 0 && (
              <div data-pdf-block="1" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
                <h3 className="font-semibold text-amber-100">검토 알림</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-amber-50">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div data-pdf-block="1" className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 shadow-[0_16px_50px_-30px_rgba(6,182,212,0.8)]">
              <h3 className="text-xl font-semibold">AI 상세 상담 카드</h3>
              <div className="mt-4 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 to-sky-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-200">핵심 3줄 요약</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-cyan-50">
                  {summaryLines.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {consultationSections.map((section) => {
                  const visual = sectionVisual(section.key);
                  const digest = buildSectionDigest(section.key, section.content, result);
                  return (
                    <div data-pdf-block="1" key={section.key} className={`rounded-2xl border p-5 ${visual.cardClass}`}>
                      <p className={`text-sm font-semibold ${visual.titleClass}`}>[{visual.tag}] {section.title}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{sectionHelper(section.key)}</p>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">한 줄 결론</p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-50">{digest.summary}</p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {digest.items.map((item, idx) => (
                          <div key={`${section.key}-${idx}`} className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${visual.badgeClass}`}>
                              {idx + 1}
                            </div>
                            <p className="text-sm leading-relaxed text-slate-100">{item}</p>
                          </div>
                        ))}
                      </div>
                      <details className="ai-raw-snippet mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-3">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                          원문 보기
                        </summary>
                        <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{section.content}</pre>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>

            <details data-pdf-block="1" className="ai-full-raw rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6">
              <summary className="cursor-pointer text-lg font-semibold text-slate-200">원문 전체 펼쳐보기</summary>
              <p className="mt-2 text-sm text-slate-400">필요할 때만 전체 상담 문장을 확인하세요.</p>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{normalizedConsultation}</pre>
            </details>
          </div>
        )}
      </div>
    </section>
  );
}

function goalSourceLabel(source?: string) {
  if (source === "AUTO") return "AI 자동 추천";
  if (source === "USER") return "사용자 입력";
  if (source === "USER_CONFIRMED") return "사용자 확정 수치";
  return "기타";
}

function sectionHelper(key: string) {
  switch (key) {
    case "current":
      return "현재 체형과 건강 상태를 쉬운 말로 풀어 읽는 구간입니다.";
    case "goal":
      return "몇 주 동안 어떤 수치를 어디까지 바꾸는지 보는 구간입니다.";
    case "nutrition":
      return "하루 식사량과 탄단지 균형을 이해하는 구간입니다.";
    case "exercise":
      return "실제로 어떤 운동을 어느 정도 할지 보는 구간입니다.";
    case "checkpoint":
      return "주차별로 무엇을 점검해야 하는지 정리한 구간입니다.";
    case "caution":
      return "무리하지 않기 위해 꼭 확인해야 하는 주의점입니다.";
    default:
      return "상담 내용을 순서대로 읽어 내려가면 됩니다.";
  }
}

function extractCoreMetrics(metrics: Record<string, string>): Record<string, string> {
  return {
    weight_kg: metrics.weight_kg || "",
    skeletal_muscle_kg: metrics.skeletal_muscle_kg || "",
    body_fat_percent: metrics.body_fat_percent || "",
    visceral_fat_level: metrics.visceral_fat_level || "",
  };
}

function sectionVisual(key: string) {
  switch (key) {
    case "current":
      return { tag: "현재", cardClass: "border-sky-500/40 bg-sky-500/10", titleClass: "text-sky-200", badgeClass: "bg-sky-300 text-slate-950" };
    case "goal":
      return { tag: "목표", cardClass: "border-cyan-500/40 bg-cyan-500/10", titleClass: "text-cyan-200", badgeClass: "bg-cyan-300 text-slate-950" };
    case "nutrition":
      return { tag: "식단", cardClass: "border-emerald-500/40 bg-emerald-500/10", titleClass: "text-emerald-200", badgeClass: "bg-emerald-300 text-slate-950" };
    case "exercise":
      return { tag: "운동", cardClass: "border-rose-500/40 bg-rose-500/10", titleClass: "text-rose-200", badgeClass: "bg-rose-300 text-slate-950" };
    case "checkpoint":
      return { tag: "체크", cardClass: "border-amber-500/40 bg-amber-500/10", titleClass: "text-amber-200", badgeClass: "bg-amber-300 text-slate-950" };
    case "caution":
      return { tag: "주의", cardClass: "border-orange-500/40 bg-orange-500/10", titleClass: "text-orange-200", badgeClass: "bg-orange-300 text-slate-950" };
    default:
      return { tag: "상담", cardClass: "border-slate-600 bg-slate-950", titleClass: "text-slate-200", badgeClass: "bg-slate-300 text-slate-950" };
  }
}

function buildSectionDigest(sectionKey: string, text: string, result: InbodyResponse) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => Boolean(line) && !isMostlyEnglish(line));

  const parsedItems = lines.flatMap((line) => splitReadableSentences(line)).filter((line) => line.length >= 12);
  const uniqueItems: string[] = [];
  for (const item of parsedItems) {
    if (!uniqueItems.includes(item)) uniqueItems.push(item);
    if (uniqueItems.length >= 4) break;
  }

  const fallback = sectionFallbackDigest(sectionKey, result);
  const merged = dedupeLines([...uniqueItems, fallback.summary, ...fallback.items]);
  const summary = merged[0] || fallback.summary;
  const items = merged.slice(0, Math.max(MIN_SECTION_DIGEST_ITEMS, Math.min(MAX_SECTION_DIGEST_ITEMS, merged.length)));

  while (items.length < MIN_SECTION_DIGEST_ITEMS) {
    items.push("핵심 수치와 이번 주 실행 항목을 함께 기록해 진행 상황을 점검하세요.");
  }

  return { summary, items };
}

function dedupeLines(lines: string[]) {
  const unique: string[] = [];
  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) continue;
    if (!unique.includes(normalized)) unique.push(normalized);
  }
  return unique;
}

function splitReadableSentences(text: string) {
  return text
    .split(/(?<=[.!?。])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.length > 110 ? `${line.slice(0, 107)}...` : line));
}

function buildConsultationSections(text: string): ConsultationSection[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const bucket = new Map<string, string[]>();
  sectionRules.forEach((r) => bucket.set(r.key, []));

  let currentKey = "current";
  for (const line of lines) {
    const headingKey = detectSectionHeadingKey(line);
    if (headingKey) {
      currentKey = headingKey;
      continue;
    }
    bucket.get(currentKey)?.push(line);
  }

  const sections = sectionRules
    .map((rule) => ({ key: rule.key, title: rule.title, content: (bucket.get(rule.key) || []).join("\n") }))
    .filter((s) => s.content.trim().length > 0);

  if (sections.length === 0) return [{ key: "full", title: "상담 내용", content: text || "-" }];
  return sections;
}

function detectSectionHeadingKey(line: string) {
  const normalized = line
    .toLowerCase()
    .replace(/^[\[\(]?[0-9]+[.)\]]?\s*/, "")
    .replace(/[：:]/g, "")
    .replace(/\s+/g, "");

  const headingMap: Array<{ key: string; aliases: string[] }> = [
    { key: "current", aliases: ["현재상태", "상태요약", "현재"] },
    { key: "goal", aliases: ["목표설정", "목표", "목표수정", "목표계획"] },
    { key: "nutrition", aliases: ["식단영양", "식단/영양", "식단", "영양"] },
    { key: "exercise", aliases: ["운동계획", "운동루틴", "운동"] },
    { key: "checkpoint", aliases: ["체크포인트", "체크", "주차체크"] },
    { key: "caution", aliases: ["주의사항", "주의", "리스크", "위험신호"] },
  ];

  for (const group of headingMap) {
    if (group.aliases.some((alias) => normalized === alias)) {
      return group.key;
    }
  }
  return null;
}

function buildKeySummaryLines(text: string, sections: ConsultationSection[], count: number): string[] {
  const candidates: string[] = [];

  for (const section of sections) {
    const first = section.content
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
      .find((line) => line.length >= 8 && !isMostlyEnglish(line));
    if (first) candidates.push(first);
  }

  if (candidates.length === 0) {
    const fallback = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter((line) => line.length >= 8 && !isMostlyEnglish(line));
    candidates.push(...fallback);
  }

  const unique: string[] = [];
  for (const line of candidates) {
    if (!unique.includes(line)) unique.push(line);
    if (unique.length >= count) break;
  }
  while (unique.length < count) unique.push("핵심 요약을 위해 추가 상담 정보를 확인해 주세요.");
  return unique.slice(0, count);
}

function normalizeConsultation(result: InbodyResponse) {
  const raw = (result.consultation || "").trim();
  if (!raw) {
    return buildFallbackConsultation(result);
  }

  const meaningfulKoreanLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && !isMostlyEnglish(line));

  if (meaningfulKoreanLines.length >= 8 && raw.length >= 700) {
    return raw;
  }

  return buildFallbackConsultation(result);
}

function buildFallbackConsultation(result: InbodyResponse) {
  const weight = result.metrics.weight_kg || "-";
  const muscle = result.metrics.skeletal_muscle_kg || "-";
  const bodyFat = result.metrics.body_fat_percent || "-";
  const visceralFat = result.metrics.visceral_fat_level || "-";
  const bmi = result.metrics.bmi || "-";
  const bmr = result.metrics.bmr_kcal || "-";
  const calories = result.dailyNutrition.calories_kcal || "-";
  const protein = result.dailyNutrition.protein_g || "-";
  const carb = result.dailyNutrition.carb_g || "-";
  const fat = result.dailyNutrition.fat_g || "-";
  const carbRatio = result.dailyNutrition.carb_ratio_percent || "-";
  const proteinRatio = result.dailyNutrition.protein_ratio_percent || "-";
  const fatRatio = result.dailyNutrition.fat_ratio_percent || "-";
  const targetWeight = result.targets.target_weight_kg || "-";
  const targetMuscle = result.targets.target_skeletal_muscle_kg || "-";
  const targetBodyFat = result.targets.target_body_fat_percent || "-";
  const firstWeek = result.weeklyCheckpoints?.[0];
  const secondWeek = result.weeklyCheckpoints?.[1];
  const thirdWeek = result.weeklyCheckpoints?.[2];
  const fourthWeek = result.weeklyCheckpoints?.[3];

  return [
    "현재 상태",
    `현재 체중은 ${weight}kg, 골격근량은 ${muscle}kg, 체지방률은 ${bodyFat}%, BMI는 ${bmi}, 내장지방 레벨은 ${visceralFat}입니다.`,
    `기초대사량은 ${bmr}kcal로 확인되며, 같은 체중이라도 체지방률과 근육량 조합에 따라 체형 변화 속도는 크게 달라질 수 있습니다.`,
    "지금 단계에서는 체중 숫자 하나만 보는 것보다 체지방 감소와 근육 유지(또는 소폭 증가)를 동시에 확인하는 해석이 더 정확합니다.",
    "특히 체지방률이 상대적으로 높은 편이라면 급격한 체중 감량보다, 식단·운동·회복을 묶어 체성분을 개선하는 접근이 장기적으로 유리합니다.",
    "",
    "목표 설정",
    `중간 목표(약 12주)는 체중 ${targetWeight}kg, 골격근량 ${targetMuscle}kg, 체지방률 ${targetBodyFat}%를 기준으로 관리하는 것을 권장합니다.`,
    "목표는 한 번에 크게 내리기보다 1~4주 단위의 짧은 체크포인트로 쪼개서 진행해야 실패 확률이 낮아집니다.",
    "체중은 완만하게 하향 추세를 만들고, 골격근량은 유지 또는 소폭 증가를 목표로 두면 외형 변화와 기초대사 유지에 도움이 됩니다.",
    "컨디션이 나쁜 주차에는 목표 속도를 낮춰도 괜찮고, 대신 루틴 지속률(식사 기록/운동 출석/수면)을 우선 지표로 관리하세요.",
    "",
    "식단/영양",
    `하루 총 섭취는 약 ${calories}kcal를 기준으로, 탄수화물 ${carb}g(${carbRatio}%), 단백질 ${protein}g(${proteinRatio}%), 지방 ${fat}g(${fatRatio}%) 수준으로 구성합니다.`,
    "초보자는 세부 식단표를 완벽하게 맞추기보다, 매 끼니 단백질을 우선 배치하고 나머지를 탄수화물/지방으로 채우는 방식이 실천이 쉽습니다.",
    "예시로는 아침(단백질+복합탄수), 점심(일반식에서 튀김·당류 조절), 저녁(단백질+채소 중심), 간식(요거트/계란/두유) 패턴이 안정적입니다.",
    "외식 시에는 '단백질 포함 메뉴 선택 + 음료 당류 최소화 + 과식 회피' 3가지만 지켜도 체지방 관리 효율이 크게 올라갑니다.",
    "",
    "운동 계획",
    "운동은 주 3~5회 기준으로, 근력운동(하체/등/전신 중심) 2~4회 + 유산소 2~4회를 병행하는 구성이 좋습니다.",
    "근력운동은 각 동작 3~4세트, 8~15회 반복 범위에서 시작하고, 매주 1개 항목(무게/반복/세트)을 소폭 올리는 방식으로 진행하세요.",
    "유산소는 걷기·사이클·경사 걷기 같은 저충격 종목을 20~40분, 대화 가능한 강도(RPE 5~7)로 유지하는 것이 회복에 유리합니다.",
    "초반 2주는 강도보다 자세·호흡·통증 여부를 기준으로 루틴을 고정하고, 이후 컨디션이 안정되면 점진적으로 볼륨을 높이세요.",
    "",
    "체크포인트",
    firstWeek?.focus
      ? `1주차 포커스는 '${firstWeek.focus}'입니다. 이 항목을 우선순위로 두고 체중/식단/운동 이행률을 함께 기록하세요.`
      : "첫 1~2주는 적응 구간으로 보고, 체중·식사·수면·피로도를 함께 기록하세요.",
    secondWeek?.focus ? `2주차에는 '${secondWeek.focus}'를 기준으로 식단 편차(주말 포함)를 줄이세요.` : "2주차에는 식단 편차를 줄이고 단백질 분배를 안정화하세요.",
    thirdWeek?.focus ? `3주차에는 '${thirdWeek.focus}'를 중심으로 운동 볼륨 또는 유산소 시간을 소폭 상향하세요.` : "3주차에는 운동 볼륨 또는 유산소 시간을 소폭 상향하세요.",
    fourthWeek?.focus ? `4주차에는 '${fourthWeek.focus}'를 확인하며 다음 4주 목표를 다시 설정하세요.` : "4주차에는 변화 추세를 점검하고 다음 4주 계획을 재설정하세요.",
    "체중은 주 1회 같은 시간대에 측정하고, 가능하면 허리둘레·주관적 피로도·운동 수행기록을 함께 관리해야 해석 정확도가 올라갑니다.",
    "",
    "주의사항",
    "무리한 감량(과도한 저열량)과 고강도 운동을 동시에 밀어붙이면 근손실·피로누적·중도 포기 위험이 높아집니다.",
    "피로감, 어지럼, 수면질 저하, 생리적 스트레스 신호가 반복되면 운동 강도를 1~2단계 낮추고 식사/수면을 먼저 복구하세요.",
    "통증이 관절 중심으로 지속되면 해당 동작은 즉시 중단하고, 가동범위가 편한 대체 동작으로 전환하는 것이 안전합니다.",
    "이 상담은 의학적 진단이 아니며, 기존 질환·복용약·통증 이력이 있으면 전문가 상담과 함께 진행하는 것을 권장합니다.",
  ].join("\n");
}

function sectionFallbackDigest(sectionKey: string, result: InbodyResponse) {
  const weight = result.metrics.weight_kg || "-";
  const bodyFat = result.metrics.body_fat_percent || "-";
  const muscle = result.metrics.skeletal_muscle_kg || "-";
  const calories = result.dailyNutrition.calories_kcal || "-";
  const protein = result.dailyNutrition.protein_g || "-";
  const firstWeek = result.weeklyCheckpoints?.[0];

  switch (sectionKey) {
    case "current":
      return {
        summary: `현재 체중 ${weight}kg, 골격근량 ${muscle}kg, 체지방률 ${bodyFat}%를 기준으로 현재 상태를 이해하면 됩니다.`,
        items: [
          "현재는 체중 숫자 하나보다 체지방과 근육량 균형을 함께 보는 것이 더 중요합니다.",
          "극단적인 감량보다 체성분을 천천히 개선하는 방향으로 해석하면 이해가 쉽습니다.",
        ],
      };
    case "goal":
      return {
        summary: "목표는 짧은 기간과 중간 기간으로 나눠서 보면 훨씬 부담이 적습니다.",
        items: [
          "1~4주 목표와 12주 목표를 따로 보면 진행 상황을 확인하기 쉽습니다.",
          "체중 변화와 함께 체지방, 근육량 변화도 같이 체크하세요.",
        ],
      };
    case "nutrition":
      return {
        summary: `하루 식단은 약 ${calories}kcal, 단백질은 ${protein}g 기준으로 이해하면 됩니다.`,
        items: [
          "초보자는 끼니마다 단백질을 나눠 챙기는 것부터 시작하는 편이 쉽습니다.",
          "탄단지 비율은 완벽함보다 꾸준하게 유지하는 것이 더 중요합니다.",
        ],
      };
    case "exercise":
      return {
        summary: "운동은 주 2~4회 정도의 꾸준한 근력운동과 쉬운 유산소부터 시작하면 충분합니다.",
        items: [
          "처음에는 강도보다 꾸준함과 자세를 우선하세요.",
          "전신 근력운동과 걷기, 실내 자전거 같은 쉬운 유산소를 함께 가져가세요.",
        ],
      };
    case "checkpoint":
      return {
        summary: firstWeek?.focus ? `첫 체크포인트는 '${firstWeek.focus}'입니다.` : "첫 1~2주는 몸이 적응하는 기간으로 보면 됩니다.",
        items: [
          "주 1회 같은 시간에 체중과 컨디션을 기록해 보세요.",
          "급격한 변화보다 천천히 좋아지는 추세를 확인하는 것이 좋습니다.",
        ],
      };
    case "caution":
      return {
        summary: "무리한 감량과 과도한 운동보다 지속 가능한 루틴이 더 중요합니다.",
        items: [
          "피로가 크면 강도를 낮추고 수면과 식사를 먼저 점검하세요.",
          "통증이 있으면 해당 운동을 멈추고 다른 동작으로 대체하세요.",
        ],
      };
    default:
      return {
        summary: "핵심 내용을 먼저 읽고 필요할 때만 원문을 펼쳐서 확인해 주세요.",
        items: ["이 화면은 초보자도 빠르게 이해할 수 있도록 핵심만 먼저 보여줍니다."],
      };
  }
}

function isMostlyEnglish(text: string) {
  const english = (text.match(/[A-Za-z]/g) || []).length;
  const korean = (text.match(/[가-힣]/g) || []).length;
  return english >= 8 && english > korean * 2;
}

function buildBeginnerHighlights(result: InbodyResponse) {
  const weight = toNumber(result.metrics.weight_kg);
  const muscle = toNumber(result.metrics.skeletal_muscle_kg);
  const bodyFatPercent = toNumber(result.metrics.body_fat_percent);
  const bmi = toNumber(result.metrics.bmi);
  const calories = toNumber(result.dailyNutrition.calories_kcal);
  const weekly = result.weeklyCheckpoints?.[0];

  return [
    {
      eyebrow: "현재 상태",
      title: beginnerStateTitle(bodyFatPercent, bmi),
      description: `체중 ${weight || "-"}kg, 골격근량 ${muscle || "-"}kg, 체지방률 ${bodyFatPercent || "-"}% 기준으로 보면 ${beginnerStateDescription(bodyFatPercent, bmi)}`,
    },
    {
      eyebrow: "우선순위",
      title: primaryFocusTitle(bodyFatPercent, muscle),
      description: primaryFocusDescription(bodyFatPercent, muscle),
    },
    {
      eyebrow: "식단 방향",
      title: calories > 0 ? `하루 약 ${calories}kcal 가이드` : "하루 식단 가이드 확인",
      description: "탄수화물, 단백질, 지방을 한 번에 크게 바꾸기보다 1~2주 간격으로 조금씩 조정하는 것이 초보자에게 더 쉽습니다.",
    },
    {
      eyebrow: "첫 체크포인트",
      title: weekly?.focus ? `1주차 포커스: ${weekly.focus}` : "첫 1~2주 적응 구간",
      description: "처음부터 강도를 높이기보다 기록을 남기고, 몸 상태와 피로도를 확인하면서 루틴을 안정적으로 굳히는 것이 중요합니다.",
    },
  ];
}

function buildActionChecklist(result: InbodyResponse) {
  const protein = toNumber(result.dailyNutrition.protein_g);
  const cardioFocus = toNumber(result.metrics.body_fat_percent) >= 28;
  return [
    "인바디 핵심 수치 4개를 다시 확인하고 오인식이 있으면 먼저 수정하세요.",
    cardioFocus
      ? "체지방 감량이 우선으로 보여 유산소와 하체·전신 근력운동을 함께 가져가는 편이 좋습니다."
      : "체지방을 유지하면서 근육량을 챙기는 방향으로 근력운동 비중을 높게 가져가세요.",
    protein > 0
      ? `단백질은 하루 약 ${protein}g를 기준으로 끼니마다 나눠 섭취하면 관리가 쉬워집니다.`
      : "단백질은 매 끼니마다 일정하게 넣는 방식이 초보자에게 가장 관리하기 쉽습니다.",
    "주 1회 같은 시간대에 체중과 컨디션을 기록해 변화 추세를 보세요.",
  ];
}

type PersonalContext = {
  gender: ProfileGender | "";
  age: number;
  heightCm: number;
};

function buildMetricInsightCards(metrics: Record<string, string>, context: PersonalContext) {
  return [
    metricInsight("골격근량", metrics.skeletal_muscle_kg ? `${metrics.skeletal_muscle_kg}kg` : "-", interpretSkeletalMuscleWithContext(toNumber(metrics.skeletal_muscle_kg), context)),
    metricInsight("BMI", metrics.bmi, interpretBmiWithContext(toNumber(metrics.bmi), context)),
    metricInsight("체지방률", metrics.body_fat_percent ? `${metrics.body_fat_percent}%` : "-", interpretBodyFatWithContext(toNumber(metrics.body_fat_percent), context)),
    metricInsight("내장지방 레벨", metrics.visceral_fat_level, interpretVisceralFatWithContext(toNumber(metrics.visceral_fat_level), context)),
  ];
}

function metricInsight(label: string, value: string, insight: MetricInsight) {
  return {
    label,
    value,
    badge: insight.badge,
    headline: insight.headline,
    description: insight.description,
    toneClass: insight.toneClass,
  };
}

type MetricInsight = {
  badge: string;
  headline: string;
  description: string;
  toneClass: string;
};

function interpretBmi(value: number): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "BMI 수치가 비어 있어 체중 범위 해석을 생략했습니다.");
  if (value < 18.5) return positiveInsight("낮은 편", "체중이 비교적 낮은 편입니다.", "무리한 감량보다 근육과 식사량을 안정적으로 확보하는 쪽이 더 중요합니다.");
  if (value < 23) return positiveInsight("표준", "체중 범위는 비교적 안정적입니다.", "현재 체중 유지 또는 체지방/근육 구성 개선에 집중하면 됩니다.");
  if (value < 25) return cautionInsight("주의", "체중 관리가 조금 필요한 구간입니다.", "식단 균형과 활동량을 조정하면 충분히 개선 가능한 범위입니다.");
  return cautionInsight("관리 필요", "체중 감량 우선순위가 높아 보입니다.", "급하게 줄이기보다 주차별 목표를 나눠 꾸준히 내려가는 것이 좋습니다.");
}

function interpretBodyFat(value: number): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "체지방률 수치가 비어 있어 해석을 생략했습니다.");
  if (value < 20) return positiveInsight("양호", "체지방률은 비교적 안정적입니다.", "지금은 감량보다 근력 향상과 체형 보정 쪽 설명을 더 중요하게 보면 됩니다.");
  if (value < 28) return cautionInsight("보통", "체지방 관리가 필요한 시작 구간입니다.", "식단과 운동을 함께 조정하면 눈에 띄는 변화를 만들기 좋습니다.");
  return cautionInsight("우선 관리", "체지방 감량이 가장 중요한 과제로 보입니다.", "유산소만 하기보다 근력운동을 함께 해야 체형 변화와 유지가 더 잘 됩니다.");
}

function interpretVisceralFat(value: number): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "내장지방 수치가 비어 있어 해석을 생략했습니다.");
  if (value <= 9) return positiveInsight("안정", "내장지방은 비교적 안정 범위입니다.", "현재 습관을 유지하면서 전체 체성분 균형을 잡으면 됩니다.");
  if (value <= 12) return cautionInsight("주의", "내장지방 관리가 필요한 구간입니다.", "수면, 식사 시간, 유산소 습관도 함께 점검하는 것이 좋습니다.");
  return cautionInsight("관리 필요", "생활습관 교정 우선순위가 높습니다.", "식단과 활동량을 동시에 조정하면서 장기적으로 줄여야 하는 수치입니다.");
}

function buildPersonalMetricSummaries(metrics: Record<string, string>, context: PersonalContext): string[] {
  const bodyFat = toNumber(metrics.body_fat_percent);
  const skeletalMuscle = toNumber(metrics.skeletal_muscle_kg);
  const bmi = toNumber(metrics.bmi);
  const visceralFat = toNumber(metrics.visceral_fat_level);

  const lines: string[] = [];
  if (bodyFat > 0) {
    const insight = interpretBodyFatWithContext(bodyFat, context);
    lines.push(`체지방률 ${bodyFat}%: ${insight.headline} ${insight.description}`);
  }
  if (skeletalMuscle > 0) {
    const insight = interpretSkeletalMuscleWithContext(skeletalMuscle, context);
    lines.push(`골격근량 ${skeletalMuscle}kg: ${insight.headline} ${insight.description}`);
  }
  if (bmi > 0) {
    const insight = interpretBmiWithContext(bmi, context);
    lines.push(`BMI ${bmi}: ${insight.headline} ${insight.description}`);
  }
  if (visceralFat > 0) {
    const insight = interpretVisceralFatWithContext(visceralFat, context);
    lines.push(`내장지방 레벨 ${visceralFat}: ${insight.headline} ${insight.description}`);
  }
  return lines;
}

function getBodyFatThreshold(gender: PersonalContext["gender"], age: number) {
  let good = gender === "FEMALE" ? 28 : 20;
  let caution = gender === "FEMALE" ? 33 : 25;
  if (age >= 40 && age < 60) {
    good += 1;
    caution += 1;
  } else if (age >= 60) {
    good += 2;
    caution += 2;
  }
  return { good, caution };
}

function getBmiThreshold(age: number) {
  const normalHigh = age >= 60 ? 24 : 23;
  const cautionHigh = age >= 60 ? 26 : 25;
  return { normalLow: 18.5, normalHigh, cautionHigh };
}

function getVisceralFatThreshold(gender: PersonalContext["gender"], age: number) {
  let stableMax = gender === "FEMALE" ? 8 : 9;
  let cautionMax = gender === "FEMALE" ? 11 : 12;
  if (age >= 60) {
    stableMax += 1;
    cautionMax += 1;
  }
  return { stableMax, cautionMax };
}

function getSkeletalMuscleThreshold(gender: PersonalContext["gender"], age: number) {
  const isFemale = gender === "FEMALE";
  const low = isFemale ? (age >= 60 ? 6 : 6.4) : age >= 60 ? 7.3 : 7.8;
  const good = isFemale ? (age >= 60 ? 7.1 : 7.6) : age >= 60 ? 8.6 : 9.2;
  return { low, good };
}

function interpretSkeletalMuscleWithContext(value: number, context: PersonalContext): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "골격근량 수치가 없어 개인 기준 해석을 생략했습니다.");
  if (context.heightCm <= 0) {
    if (value < 18) return cautionInsight("주의", "골격근량이 낮은 편입니다.", "주 2~3회 근력운동과 단백질 섭취를 먼저 고정하세요.");
    if (value < 24) return cautionInsight("보완", "골격근량이 보통 범위입니다.", "전신 근력 루틴 강도를 조금씩 높이면 개선 효과가 큽니다.");
    return positiveInsight("좋음", "골격근량이 양호한 편입니다.", "현재 근력 루틴을 유지하며 체지방 관리에 집중하세요.");
  }

  const heightM = context.heightCm / 100;
  const smi = value / (heightM * heightM);
  const threshold = getSkeletalMuscleThreshold(context.gender, context.age);
  if (smi < threshold.low) {
    return cautionInsight("주의", `키 대비 골격근량이 낮은 편입니다 (SMI ${round1(smi)}).`, "하체·등 중심 근력운동과 단백질 섭취를 우선 강화하세요.");
  }
  if (smi < threshold.good) {
    return cautionInsight("보완", `키 대비 골격근량이 보통 범위입니다 (SMI ${round1(smi)}).`, "주 2~3회 전신 근력 루틴으로 근육량을 소폭 올리면 좋습니다.");
  }
  return positiveInsight("좋음", `키 대비 골격근량이 양호합니다 (SMI ${round1(smi)}).`, "현재 루틴을 유지하고 체지방·근육 균형 조정에 집중하세요.");
}

function interpretBmiWithContext(value: number, context: PersonalContext): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "BMI 수치가 없어 개인 기준 해석을 생략했습니다.");
  if (!context.age) return interpretBmi(value);

  const threshold = getBmiThreshold(context.age);
  if (value < threshold.normalLow) {
    return cautionInsight("주의", "BMI가 낮은 편입니다.", "감량보다 근력운동과 충분한 영양 섭취를 우선하세요.");
  }
  if (value < threshold.normalHigh) {
    return positiveInsight("좋음", "BMI가 개인 기준 정상 범위입니다.", "현재 생활 패턴을 유지하며 체지방률·근육량을 함께 관리하세요.");
  }
  if (value < threshold.cautionHigh) {
    return cautionInsight("주의", "BMI가 경계 범위입니다.", "간식·야식 조정과 주간 유산소 증가로 개선할 수 있습니다.");
  }
  return cautionInsight("관리 필요", "BMI가 높은 범위입니다.", "급격한 감량보다 4~8주 단위 체지방 감량 루틴을 유지하세요.");
}

function interpretBodyFatWithContext(value: number, context: PersonalContext): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "체지방률 수치가 없어 개인 기준 해석을 생략했습니다.");
  if (!context.gender && !context.age) return interpretBodyFat(value);

  const threshold = getBodyFatThreshold(context.gender, context.age);
  if (value <= threshold.good) {
    return positiveInsight("좋음", "체지방률이 개인 기준 양호합니다.", "근력운동 비중을 유지하고 식단 균형 점검에 집중하세요.");
  }
  if (value <= threshold.caution) {
    return cautionInsight("주의", "체지방률이 경계 범위입니다.", "탄수화물 섭취 타이밍과 주간 활동량 조정이 필요합니다.");
  }
  return cautionInsight("관리 필요", "체지방률이 높은 범위입니다.", "유산소+근력 병행 루틴과 칼로리 적자를 함께 유지하세요.");
}

function interpretVisceralFatWithContext(value: number, context: PersonalContext): MetricInsight {
  if (!value) return neutralInsight("데이터 확인", "내장지방 수치가 없어 개인 기준 해석을 생략했습니다.");
  if (!context.gender && !context.age) return interpretVisceralFat(value);

  const threshold = getVisceralFatThreshold(context.gender, context.age);
  if (value <= threshold.stableMax) {
    return positiveInsight("안정", "내장지방이 개인 기준 안정 범위입니다.", "현재 수면/식습관 리듬을 유지하면 장기 관리에 유리합니다.");
  }
  if (value <= threshold.cautionMax) {
    return cautionInsight("주의", "내장지방 관리가 필요한 구간입니다.", "야식/음주 빈도 조정과 식후 유산소를 추가하세요.");
  }
  return cautionInsight("관리 필요", "내장지방이 높은 범위입니다.", "식단과 운동을 동시에 조정해 4주 단위로 추적 관리하세요.");
}

function positiveInsight(badge: string, headline: string, description: string): MetricInsight {
  return { badge, headline, description, toneClass: "bg-emerald-400/15 text-emerald-200 border border-emerald-300/30" };
}

function cautionInsight(badge: string, headline: string, description: string): MetricInsight {
  return { badge, headline, description, toneClass: "bg-amber-400/15 text-amber-100 border border-amber-300/30" };
}

function neutralInsight(headline: string, description: string): MetricInsight {
  return { badge: "확인 필요", headline, description, toneClass: "bg-slate-400/15 text-slate-100 border border-slate-300/30" };
}

function beginnerStateTitle(bodyFatPercent: number, bmi: number) {
  if (bodyFatPercent >= 28 || bmi >= 25) return "감량 중심으로 보면 이해하기 쉬운 상태";
  if (bodyFatPercent >= 20) return "체형 개선과 감량을 함께 보기 좋은 상태";
  return "체중 유지보다 체성분 개선을 보기 좋은 상태";
}

function beginnerStateDescription(bodyFatPercent: number, bmi: number) {
  if (bodyFatPercent >= 28 || bmi >= 25) return "체중 자체보다 체지방을 꾸준히 낮추는 방향으로 읽는 것이 좋습니다.";
  if (bodyFatPercent >= 20) return "지방을 조금씩 줄이면서 근육량을 지키는 방향이 이해하기 쉽습니다.";
  return "숫자를 크게 줄이기보다 근육량과 라인 개선에 더 집중하면 됩니다.";
}

function primaryFocusTitle(bodyFatPercent: number, muscle: number) {
  if (bodyFatPercent >= 28) return "체지방 감량을 먼저 보는 것이 좋습니다.";
  if (muscle > 0 && muscle < 18) return "근육량 확보를 같이 보는 것이 좋습니다.";
  return "현재 루틴을 안정적으로 유지하며 미세 조정하면 됩니다.";
}

function primaryFocusDescription(bodyFatPercent: number, muscle: number) {
  if (bodyFatPercent >= 28) return "지방 감량이 우선이지만, 근력운동을 함께 해야 몸매 변화와 요요 방지에 도움이 됩니다.";
  if (muscle > 0 && muscle < 18) return "먹는 양을 너무 줄이지 말고, 하체·등·전신 위주 근력운동으로 기본 근육량을 올리는 쪽이 좋습니다.";
  return "극단적인 감량보다는 주차별 목표를 지키면서 컨디션과 자세를 꾸준히 점검하는 것이 효율적입니다.";
}

function buildDomain(values: number[], padding: number): [number, number] {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return [0, 100];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const start = Math.max(0, Math.floor(min - padding));
  const end = Math.ceil(max + padding);
  if (start === end) return [Math.max(0, start - 1), end + 1];
  return [start, end];
}

function Badge({ label, warning }: { label: string; warning?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        warning ? "border-amber-300/60 bg-amber-300/10 text-amber-100" : "border-cyan-300/35 bg-cyan-500/5 text-cyan-100"
      }`}
    >
      {label}
    </span>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-[0_12px_40px_-25px_rgba(56,189,248,0.55)]">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-900/70 p-4 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.15)]">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

const toNumber = (value?: string) => {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const round1 = (value: number) => Math.round(value * 10) / 10;
