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
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";
import { friendlyError, httpError } from "../lib/httpError";
import { api } from "../lib/api";
import { toast } from "../lib/toast";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type InbodyResponse = {
  consultation: string;
  metrics: Record<string, string>;
  targets: Record<string, string>;
  dailyNutrition: Record<string, string>;
  structuredReport: Record<string, string>;
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

const consultationSectionRules: Array<{ key: string; title: string; keywords: string[] }> = [
  { key: "overall", title: "한 줄 총평", keywords: ["한줄총평", "총평", "요약결론", "overall"] },
  { key: "diagnosis", title: "현재 몸 상태 진단", keywords: ["현재몸상태진단", "현재몸상태", "상태진단", "진단", "currentstatus"] },
  { key: "metrics", title: "항목별 해석", keywords: ["항목별해석", "수치해석", "지표해석", "metrics"] },
  { key: "strengths", title: "좋은 점", keywords: ["좋은점", "강점", "strengths"] },
  { key: "issues", title: "부족한 점 / 시급한 문제", keywords: ["부족한점", "시급한문제", "문제점", "우선순위", "issues"] },
  { key: "plan", title: "어떻게 해야 하는지", keywords: ["어떻게해야하는지", "실행계획", "운동", "식단", "생활습관", "plan"] },
  { key: "fourWeeks", title: "4주 행동 가이드", keywords: ["4주행동가이드", "4주가이드", "4주계획", "4week"] },
  { key: "nextCheck", title: "다음 인바디 체크 포인트", keywords: ["다음인바디", "체크포인트", "다음측정", "nextcheck"] },
];

// 차트 색 — 화면 전체에서 의미를 하나로 고정한다. 현재 = 철판 회색, 목표 = 원판 빨강.
const CHART = {
  current: "#BDBEC1",
  target: "#D9302A",
  axis: "#55585F",
  grid: "#3A3D43",
  tick: "#A6A8AD",
  ink: "#0E0E10",
  chalk: "#E8E6E0",
  chalkText: "#EEECE6",
  panel: "#26272B",
  cursor: "rgba(255,255,255,0.06)",
} as const;
const NUM_FONT = "'Big Shoulders Display', 'IBM Plex Sans KR', sans-serif";
const axisTick = { fill: CHART.tick, fontFamily: NUM_FONT, fontSize: 14, fontWeight: 700 };
const tooltipContentStyle = {
  background: CHART.panel,
  border: `3px solid ${CHART.ink}`,
  borderRadius: 6,
  boxShadow: `0 4px 0 ${CHART.ink}`,
  color: CHART.chalkText,
};
const tooltipLabelStyle = { color: CHART.chalkText, fontWeight: 700 };
const tooltipItemStyle = { color: CHART.chalkText, fontFamily: NUM_FONT, fontWeight: 700, fontSize: 15 };
// 탄단지 — 단백질 파랑, 탄수화물 노랑, 지방 초록
const nutritionColors: Record<string, string> = { 단백질: "#2F6FD0", 탄수화물: "#F0BE2E", 지방: "#2E9C55" };
// 기록지(화이트보드) 위 입력칸
const boardField =
  "mt-2 block w-full rounded-md border-2 border-steel-300 bg-white px-3 py-2 text-sm font-normal text-board-ink placeholder:text-steel-500 transition-colors hover:border-steel-500 focus:border-board-blue focus:outline-none";
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
  const [goalSaving, setGoalSaving] = useState(false);

  // 결과의 하루 영양 목표를 식단 기록(/diet)의 목표로 저장한다
  const saveDietGoal = async () => {
    if (!result || goalSaving) return;
    const n = result.dailyNutrition;
    const toInt = (v?: string) => {
      const x = toNumber(v);
      return x > 0 ? Math.round(x) : null;
    };
    const body = { kcal: toInt(n.calories_kcal), proteinG: toInt(n.protein_g), carbG: toInt(n.carb_g), fatG: toInt(n.fat_g), source: "INBODY" };
    if (body.kcal == null && body.proteinG == null && body.carbG == null && body.fatG == null) {
      toast("저장할 영양 목표가 없어요.", "error");
      return;
    }
    setGoalSaving(true);
    try {
      await api.put("/api/diet/goal", body);
      toast("식단 목표로 저장했어요. 식단 기록에서 비교해 볼 수 있어요.", "success");
    } catch (err) {
      toast(friendlyError(err, "식단 목표를 저장하지 못했어요."), "error");
    } finally {
      setGoalSaving(false);
    }
  };
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
    return result ? buildCombinedConsultationSections(result, normalizedConsultation) : [];
  }, [result, normalizedConsultation]);

  const summaryLines = useMemo(() => buildKeySummaryLines(normalizedConsultation, consultationSections, 3), [normalizedConsultation, consultationSections]);
  const consultationSectionMap = useMemo(
    () => Object.fromEntries(consultationSections.map((section) => [section.key, section])),
    [consultationSections]
  );
  const prioritySections = useMemo(
    () =>
      consultationSections.filter((section) =>
        ["overall", "diagnosis", "priority", "issues", "riskSignals"].includes(section.key)
      ),
    [consultationSections]
  );
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
      if (!res.ok) throw await httpError(res, "상담 요청을 처리하지 못했어요.");
      const data = (await res.json()) as InbodyResponse;
      setResult(data);
      setConfirmedMetrics(extractCoreMetrics(data.metrics));
    } catch (err: any) {
      setError(friendlyError(err, "분석 중 오류가 발생했습니다."));
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
      if (!res.ok) throw await httpError(res, "상담 요청을 처리하지 못했어요.");
      const data = (await res.json()) as InbodyResponse;
      setResult(data);
      setConfirmedMetrics(extractCoreMetrics(data.metrics));
    } catch (err: any) {
      setError(friendlyError(err, "직접 입력 상담 중 오류가 발생했습니다."));
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
      if (!res.ok) throw await httpError(res, "상담 요청을 처리하지 못했어요.");
      const data = (await res.json()) as InbodyResponse;
      setResult(data);
      setConfirmedMetrics(extractCoreMetrics(data.metrics));
    } catch (err: any) {
      setError(friendlyError(err, "재상담 중 오류가 발생했습니다."));
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
          background: #1a1a1c !important;
        }
        [data-pdf-capture="true"][data-pdf-exporting="1"],
        [data-pdf-capture="true"][data-pdf-exporting="1"] * {
          animation: none !important;
          transition: none !important;
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
      // 웹 폰트(Black Han Sans, Big Shoulders 등)가 다 로드된 뒤에 캡처해야 글꼴이 바뀌지 않는다.
      if (document.fonts?.ready) await document.fonts.ready;

      const blocks = Array.from(
        target.querySelectorAll<HTMLElement>('[data-pdf-block="1"]')
      ).filter((el) => !el.parentElement?.closest('[data-pdf-block="1"]'));

      const captureNodes = blocks.length > 0 ? blocks : [target];

      for (const node of captureNodes) {
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#1a1a1c",
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
      setError(friendlyError(err, "PDF 생성 중 오류가 발생했습니다."));
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
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-chalk lg:px-10">
      <div ref={captureRef} data-pdf-capture="true" className="relative mx-auto max-w-6xl space-y-6">
        <div data-pdf-block="1" className="dg-steel dg-rise relative p-6 md:p-8">
          <p className="dg-chip relative bg-plate-yellow text-sm text-black">AI InBody Studio</p>
          <h1 className="relative mt-3 text-3xl leading-tight md:text-4xl">인바디 AI 상담 대시보드</h1>
          <p className="relative mt-3 max-w-3xl text-sm text-steel-300 md:text-base">OCR 추출, 핵심 수치 재확인, 맞춤 상담과 차트, PDF 보고서까지 한 화면에서 빠르게 처리합니다.</p>
          <div className="relative mt-5 grid gap-3 md:grid-cols-3">
            {workflowCards.map((card, idx) => (
              <div
                key={card.step}
                className="dg-well dg-rise p-4 transition-transform duration-150 hover:-translate-y-0.5"
                style={{ animationDelay: `${120 + idx * 60}ms` }}
              >
                <p className="font-num text-base font-black tracking-wide text-plate-yellow">{card.step}</p>
                <p className="mt-1 text-sm font-semibold text-chalk">{card.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-steel-300">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <form data-pdf-block="1" onSubmit={onSubmit} className="dg-whiteboard dg-rise grid gap-4 p-6 md:grid-cols-2" style={{ animationDelay: "60ms" }}>
          <div className="md:col-span-2">
            <p className="text-sm font-bold">상담 시작 방식</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {consultModes.map((mode) => {
                const selected = consultMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setConsultMode(mode.value)}
                    className={`rounded-md border-2 px-4 py-4 text-left transition duration-150 ${
                      selected
                        ? "-translate-y-0.5 border-board-ink border-l-[8px] border-l-board-red bg-white shadow-md"
                        : "border-steel-300 bg-board hover:-translate-y-0.5 hover:border-board-ink hover:bg-white"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-board-ink">
                      {mode.label}
                      {selected && <CheckMark className="dg-pop h-4 w-4 text-board-red" />}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-steel-600">{mode.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <label className="block text-sm font-semibold">
              성별(선택)
              <select
                value={profileGender}
                onChange={(e) => setProfileGender(e.target.value as ProfileGender | "")}
                className={boardField}
              >
                <option value="">선택 안 함</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              나이(선택)
              <input
                type="number"
                min={0}
                max={120}
                value={profileAge}
                onChange={(e) => setProfileAge(e.target.value)}
                placeholder="예: 29"
                className={boardField}
              />
            </label>
            <label className="block text-sm font-semibold">
              키(cm, 선택)
              <input
                type="number"
                min={0}
                max={250}
                value={profileHeightCm}
                onChange={(e) => setProfileHeightCm(e.target.value)}
                placeholder="예: 170"
                className={boardField}
              />
            </label>
          </div>

          {consultMode === "upload" ? (
            <label className="block text-sm font-semibold">
              인바디 파일 (이미지/PDF)
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={`${boardField} file:mr-3 file:cursor-pointer file:rounded file:border-2 file:border-board-ink file:bg-board-ink file:px-3 file:py-1 file:text-xs file:font-bold file:text-white hover:border-board-ink`}
              />
              <p className="mt-1 text-xs font-normal text-steel-600">{file?.name ? `선택 파일: ${file.name}` : "선택된 파일 없음"}</p>
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
                <label key={key} className="block text-sm font-semibold">
                  {label}
                  <input
                    type="text"
                    value={manualMetrics[key] || ""}
                    onChange={(e) => setManualMetrics((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={key === "weight_kg" ? "예: 55.2" : "직접 입력"}
                    className={boardField}
                  />
                </label>
              ))}
            </div>
          )}

          <label className="block text-sm font-semibold">
            목표
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: 12주 동안 체지방 8kg 감량"
              className={boardField}
            />
            <p className="mt-1 text-xs font-normal text-steel-600">비워두면 AI가 자동 목표를 추천합니다.</p>
          </label>

          <div className="md:col-span-2">
            <p className="text-sm font-bold">목표 강도</p>
            <div className="relative mt-2 inline-grid grid-cols-3 rounded-md border-2 border-board-ink bg-white p-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 left-1 top-1 rounded border-2 border-black bg-plate-red shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
                style={{
                  width: "calc((100% - 0.5rem) / 3)",
                  transform: `translateX(${Math.max(0, goalIntensityOptions.findIndex((o) => o.value === goalIntensity)) * 100}%)`,
                }}
              />
              {goalIntensityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={goalIntensity === opt.value}
                  onClick={() => setGoalIntensity(opt.value)}
                  className={`relative z-10 min-w-[4.5rem] rounded px-4 py-1.5 text-xs font-bold transition-colors ${
                    goalIntensity === opt.value ? "text-white" : "text-board-ink hover:text-board-red"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-semibold md:col-span-2">
            추가 메모
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 주 4회 운동 가능, 무릎 부담 운동은 피하고 싶음"
              className={boardField}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button type="submit" disabled={loading} className="dg-btn dg-btn-primary">
              {loading ? "AI 상담 중..." : consultMode === "upload" ? "분석 시작" : "직접 입력 상담 시작"}
            </button>
            {result && (
              <button type="button" onClick={exportPdf} disabled={pdfLoading} className="dg-btn dg-btn-steel text-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                </svg>
                {pdfLoading ? "PDF 생성 중..." : "PDF 다운로드"}
              </button>
            )}
            {result && (
              <button type="button" onClick={() => void saveDietGoal()} disabled={goalSaving} className="dg-btn dg-btn-steel text-sm">
                {goalSaving ? "저장 중..." : "식단 목표로 저장"}
              </button>
            )}
            {(loading || pdfLoading) && (
              <span className="dg-loading-plates" aria-label="불러오는 중">
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
          <p className="text-xs text-steel-600 md:col-span-2">의료 진단이 아닌 운동/영양 코칭 참고 자료입니다.</p>
        </form>

        {error && (
          <div data-pdf-block="1" className="dg-well dg-pop border-l-[6px] border-l-plate-red p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="dg-steel dg-rise flex items-center gap-4 p-6">
            <span className="dg-loading-plates" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
            <p className="text-sm font-semibold text-steel-200">AI 상담 중...</p>
          </div>
        )}

        {!result && !loading && (
          <div data-pdf-block="1" className="dg-steel dg-rise relative p-6 md:p-8" style={{ animationDelay: "120ms" }}>
            <h3 className="font-display text-xl text-chalk">상담 시작 전 안내</h3>
            <p className="mt-2 text-sm leading-relaxed text-steel-300">
              인바디 원본 수치가 잘 보이는 이미지나 PDF를 올리면 정확도가 올라갑니다. 목표를 구체적으로 작성할수록 상담 카드 품질이 좋아집니다.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { text: "파일 권장: 정면 촬영, 그림자 최소화", stripe: "border-l-plate-blue" },
                { text: "목표 예시: 8주 체지방률 3%p 감량", stripe: "border-l-plate-green" },
                { text: "결과 제공: 차트 + 주차별 목표 + PDF", stripe: "border-l-plate-yellow" },
              ].map((tip, idx) => (
                <div
                  key={tip.text}
                  className={`dg-well dg-plate-in border-l-[6px] px-4 py-3 text-xs text-steel-200 ${tip.stripe}`}
                  style={{ animationDelay: `${200 + idx * 60}ms` }}
                >
                  {tip.text}
                </div>
              ))}
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
              <div className="dg-steel dg-rise border-l-[8px] border-l-plate-yellow p-6">
                <p className="font-num text-base font-black tracking-wide text-plate-yellow">Beginner Friendly Summary</p>
                <h2 className="mt-2 font-display text-2xl text-chalk">한눈에 보는 현재 상태와 다음 액션</h2>
                <p className="mt-2 text-sm leading-relaxed text-steel-300">
                  아래 카드만 읽어도 지금 상태, 우선순위, 식단/운동 방향을 빠르게 이해할 수 있게 정리했습니다.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {beginnerHighlights.map((item, idx) => (
                    <div
                      key={item.title}
                      className="dg-well dg-rise p-4 transition-transform duration-150 hover:-translate-y-0.5"
                      style={{ animationDelay: `${80 + idx * 50}ms` }}
                    >
                      <p className="text-xs font-bold text-yellow-300">{item.eyebrow}</p>
                      <p className="mt-1 text-base font-semibold text-chalk">{item.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-steel-300">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <ChecklistBoard key={actionChecklist.join("|")} items={actionChecklist} />
            </div>

            {prioritySections.length > 0 && (
              <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-2">
                {prioritySections.map((section, sIdx) => {
                  const visual = sectionVisual(section.key);
                  const digest = buildSectionDigest(section.key, section.content, result);
                  return (
                    <div
                      key={`priority-${section.key}`}
                      className={`dg-steel dg-rise border-l-[8px] p-5 ${visual.stripe}`}
                      style={{ animationDelay: `${sIdx * 60}ms` }}
                    >
                      <p className={`text-sm font-bold ${visual.titleClass}`}>[{visual.tag}] {section.title}</p>
                      <p className="mt-3 text-base font-semibold leading-relaxed text-chalk">{digest.summary}</p>
                      <div className="mt-4 space-y-2">
                        {digest.items.slice(0, 3).map((item, idx) => (
                          <NumberedRow key={`priority-item-${section.key}-${idx}`} index={idx} badgeClass={visual.badgeClass} text={item} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(consultationSectionMap.priority || consultationSectionMap.riskSignals || consultationSectionMap.misconceptions) && (
              <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="dg-steel dg-rise border-l-[8px] border-l-plate-red p-6">
                  <p className="font-num text-base font-black tracking-wide text-red-300">Priority Ladder</p>
                  <h3 className="mt-2 font-display text-xl text-chalk">무엇부터 바꿔야 하는지 순서대로 정리</h3>
                  <div className="mt-4 space-y-3">
                    {buildSectionDigest(
                      "priority",
                      consultationSectionMap.priority?.content || consultationSectionMap.issues?.content || "",
                      result
                    ).items.slice(0, 3).map((item, idx) => (
                      <div
                        key={`priority-ladder-${idx}`}
                        className="dg-well dg-plate-in flex items-start gap-3 p-4"
                        style={{ animationDelay: `${100 + idx * 60}ms`, ["--from" as string]: "-40px" }}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-black bg-plate-red font-num text-lg font-black text-white shadow-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-num text-sm font-black tracking-wide text-red-300">Priority {idx + 1}</p>
                          <p className="mt-1 text-sm leading-relaxed text-steel-100">{item}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {consultationSectionMap.riskSignals && (
                    <div className="dg-steel dg-rise border-l-[8px] border-l-plate-red p-6" style={{ animationDelay: "60ms" }}>
                      <p className="flex items-center gap-2 font-num text-base font-black tracking-wide text-red-300">
                        <WarnIcon />
                        Risk Signals
                      </p>
                      <h3 className="mt-2 font-display text-xl text-chalk">이런 신호가 보이면 방향을 다시 봐야 함</h3>
                      <div className="mt-4 space-y-3">
                        {buildSectionDigest("riskSignals", consultationSectionMap.riskSignals.content, result).items.slice(0, 3).map((item, idx) => (
                          <div key={`risk-signal-${idx}`} className="dg-well dg-rise p-4" style={{ animationDelay: `${120 + idx * 50}ms` }}>
                            <p className="text-sm font-bold text-red-300">경고 {idx + 1}</p>
                            <p className="mt-2 text-sm leading-relaxed text-steel-100">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {consultationSectionMap.misconceptions && (
                    <div className="dg-steel dg-rise border-l-[8px] border-l-plate-yellow p-6" style={{ animationDelay: "120ms" }}>
                      <p className="font-num text-base font-black tracking-wide text-yellow-300">Beginner Corrections</p>
                      <h3 className="mt-2 font-display text-xl text-chalk">초보자가 가장 자주 오해하는 포인트</h3>
                      <div className="mt-4 space-y-3">
                        {buildSectionDigest("misconceptions", consultationSectionMap.misconceptions.content, result).items.slice(0, 3).map((item, idx) => (
                          <div key={`misconception-${idx}`} className="dg-well dg-rise p-4" style={{ animationDelay: `${160 + idx * 50}ms` }}>
                            <p className="text-xs font-bold text-yellow-300">오해 정정 {idx + 1}</p>
                            <p className="mt-2 text-sm leading-relaxed text-steel-100">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(consultationSectionMap.exercisePlan || consultationSectionMap.nutritionPlan || consultationSectionMap.lifestylePlan || consultationSectionMap.donts) && (
              <div data-pdf-block="1" className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
                {[
                  { key: "exercisePlan", title: "운동", subtitle: "운동 계획", section: consultationSectionMap.exercisePlan },
                  { key: "nutritionPlan", title: "식단", subtitle: "식단 계획", section: consultationSectionMap.nutritionPlan },
                  { key: "lifestylePlan", title: "생활", subtitle: "생활습관 계획", section: consultationSectionMap.lifestylePlan },
                  { key: "donts", title: "금지", subtitle: "하지 말아야 할 것", section: consultationSectionMap.donts },
                ]
                  .filter((item) => item.section)
                  .map((item, cIdx) => {
                    const visual = sectionVisual(item.key);
                    const digest = buildSectionDigest(item.key, item.section?.content || "", result);
                    return (
                      <div
                        key={`detail-${item.key}`}
                        className={`dg-steel dg-rise border-t-[8px] p-5 transition-transform duration-150 hover:-translate-y-0.5 ${visual.stripeTop}`}
                        style={{ animationDelay: `${cIdx * 60}ms` }}
                      >
                        <p className={`dg-chip ${visual.badgeClass}`}>{item.title}</p>
                        <h3 className="mt-2 font-display text-lg text-chalk">{item.subtitle}</h3>
                        <p className="mt-3 text-sm font-medium leading-relaxed text-steel-100">{digest.summary}</p>
                        <div className="mt-4 space-y-2">
                          {digest.items.slice(0, 3).map((line, idx) => (
                            <div key={`detail-line-${item.key}-${idx}`} className="dg-well px-3 py-3 text-sm leading-relaxed text-steel-100">
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div data-pdf-block="1" className="dg-whiteboard p-5">
              <h3 className="font-pen text-3xl leading-none text-board-red">입력값 재확인 (핵심 4개)</h3>
              <p className="mt-1 text-xs text-steel-600">오인식이 의심되면 수정 후 재상담을 눌러 주세요.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CORE_KEYS.map((key) => (
                  <label key={key} className="text-xs font-semibold">
                    {metricLabels[key]}
                    <input
                      type="text"
                      value={confirmedMetrics[key] || ""}
                      onChange={(e) => setConfirmedMetrics((prev) => ({ ...prev, [key]: e.target.value }))}
                      className={`${boardField} font-num text-base font-bold`}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold">
                  재상담 목표 (선택)
                  <input
                    type="text"
                    value={reviewGoal}
                    onChange={(e) => setReviewGoal(e.target.value)}
                    placeholder={goal || "예: 체지방 감량 + 근육량 유지"}
                    className={boardField}
                  />
                </label>
                <label className="text-xs font-semibold">
                  재상담 추가 메모 (선택)
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={notes || "예: 식단은 현실적으로 간단하게"}
                    className={boardField}
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={rerunWithConfirmedMetrics}
                  disabled={reviewLoading}
                  className="dg-btn dg-chalk-burst bg-plate-yellow text-sm text-black"
                >
                  {reviewLoading ? "재상담 중..." : "확정값으로 재상담"}
                </button>
                {reviewLoading && (
                  <span className="dg-loading-plates" aria-label="불러오는 중">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
            </div>

            <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-3">
              {metricInsightCards.map((item, idx) => (
                <div
                  key={item.label}
                  className="dg-steel dg-rise dg-lift p-5"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-steel-400">{item.label}</p>
                      <AnimatedValue value={item.value} className="mt-1 font-num text-4xl font-black text-chalk" />
                    </div>
                    <span className={`dg-chip dg-pop text-xs ${item.toneClass}`} style={{ animationDelay: `${300 + idx * 60}ms` }}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-chalk">{item.headline}</p>
                  <p className="mt-2 text-sm leading-relaxed text-steel-300">{item.description}</p>
                </div>
              ))}
            </div>

            {personalInterpretation.length > 0 && (
              <div data-pdf-block="1" className="dg-steel dg-rise border-l-[8px] border-l-plate-blue p-5">
                <h3 className="text-sm font-bold text-blue-300">개인 기준 해석 요약</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-steel-200 marker:text-blue-300">
                  {personalInterpretation.map((line, idx) => (
                    <li key={`${line}-${idx}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div data-pdf-block="1" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metricLabels).map(([key, label], idx) => (
                <MetricCard key={key} label={label} value={result.metrics?.[key] || "-"} delay={idx * 40} />
              ))}
            </div>

            <div data-pdf-block="1" className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="현재 vs 목표 (고정 축)">
                {(inView) => (
                  <>
                    <p className="mb-3 text-sm leading-relaxed text-steel-300">
                      회색 막대는 현재, 빨간 막대는 목표입니다. 두 막대 차이가 클수록 우선적으로 조정해야 할 항목입니다.
                    </p>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart key={inView ? "in" : "out"} data={compositionData} barGap={6}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                          <XAxis dataKey="name" stroke={CHART.axis} tick={axisTick} tickLine={false} />
                          <YAxis stroke={CHART.axis} domain={compositionDomain} tick={axisTick} tickLine={false} />
                          <Tooltip
                            formatter={(v: any) => `${v}`}
                            cursor={{ fill: CHART.cursor }}
                            contentStyle={tooltipContentStyle}
                            labelStyle={tooltipLabelStyle}
                            itemStyle={tooltipItemStyle}
                          />
                          <Legend iconType="square" formatter={legendText} />
                          <Bar
                            dataKey="current"
                            name="현재"
                            fill={CHART.current}
                            stroke={CHART.ink}
                            strokeWidth={2}
                            radius={[3, 3, 0, 0]}
                            animationDuration={900}
                            animationEasing="ease-out"
                          />
                          <Bar
                            dataKey="target"
                            name="목표"
                            fill={CHART.target}
                            stroke={CHART.ink}
                            strokeWidth={2}
                            radius={[3, 3, 0, 0]}
                            animationBegin={220}
                            animationDuration={900}
                            animationEasing="ease-out"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </ChartCard>

              <ChartCard title="탄단지 비율">
                {(inView) => (
                  <>
                    <p className="mb-3 text-sm leading-relaxed text-steel-300">
                      식단을 숫자로 보기 어렵다면 이 원형 차트만 보셔도 됩니다. 비율이 너무 한쪽으로 치우치면 식단 균형을 다시 잡는 게 좋습니다.
                    </p>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart key={inView ? "in" : "out"}>
                          <Pie
                            data={macroData}
                            dataKey="ratio"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={100}
                            stroke={CHART.ink}
                            strokeWidth={3}
                            label={renderMacroLabel}
                            labelLine={{ stroke: CHART.axis }}
                            animationDuration={900}
                          >
                            {macroData.map((entry, idx) => (
                              <Cell key={idx} fill={nutritionColors[entry.name] ?? CHART.current} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: unknown) => `${v}%`}
                            contentStyle={tooltipContentStyle}
                            labelStyle={tooltipLabelStyle}
                            itemStyle={tooltipItemStyle}
                          />
                          <Legend iconType="square" formatter={legendText} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {macroGuide && (
                      <div className="dg-well mt-3 p-3 text-sm">
                        <p className="font-semibold text-chalk">하루 권장 섭취량</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-steel-200">
                          <span>
                            총 <CountNumber value={macroGuide.calories} className="font-num text-lg font-black text-chalk" /> kcal
                          </span>
                          <MacroSwatch color={nutritionColors["탄수화물"]} label="탄수화물" value={macroGuide.carb} />
                          <MacroSwatch color={nutritionColors["단백질"]} label="단백질" value={macroGuide.protein} />
                          <MacroSwatch color={nutritionColors["지방"]} label="지방" value={macroGuide.fat} />
                        </p>
                        <p className="mt-2 text-xs text-steel-400">
                          1일 3끼 기준(대략): 탄수화물 {macroGuide.carbPerMeal}g / 단백질 {macroGuide.proteinPerMeal}g / 지방 {macroGuide.fatPerMeal}g
                        </p>
                      </div>
                    )}
                  </>
                )}
              </ChartCard>
            </div>

            <div data-pdf-block="1">
              <ChartCard title="주차별 목표 추이 (고정 축)">
                {(inView) => (
                  <>
                    <p className="mb-3 text-sm leading-relaxed text-steel-300">
                      주차별로 체중과 체지방량이 어떻게 변해야 하는지 보여줍니다. 급격한 하락보다 꾸준한 하락이 더 안정적인 계획입니다.
                    </p>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart key={inView ? "in" : "out"} data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                          <XAxis dataKey="week" stroke={CHART.axis} tick={axisTick} tickLine={false} />
                          <YAxis stroke={CHART.axis} domain={weeklyDomain} tick={axisTick} tickLine={false} />
                          <Tooltip
                            cursor={{ stroke: CHART.axis, strokeWidth: 2 }}
                            contentStyle={tooltipContentStyle}
                            labelStyle={tooltipLabelStyle}
                            itemStyle={tooltipItemStyle}
                          />
                          <Legend formatter={legendText} />
                          <Line
                            type="monotone"
                            dataKey="weight"
                            name="목표 체중"
                            stroke={CHART.target}
                            strokeWidth={4}
                            dot={{ r: 5, fill: CHART.target, stroke: CHART.ink, strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: CHART.target, stroke: CHART.ink, strokeWidth: 2 }}
                            animationDuration={1200}
                          />
                          <Line
                            type="monotone"
                            dataKey="fat"
                            name="목표 체지방량"
                            stroke={CHART.chalk}
                            strokeWidth={3}
                            strokeDasharray="7 5"
                            dot={{ r: 5, fill: CHART.chalk, stroke: CHART.ink, strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: CHART.chalk, stroke: CHART.ink, strokeWidth: 2 }}
                            animationBegin={200}
                            animationDuration={1200}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </ChartCard>
            </div>

            {result.warnings?.length > 0 && (
              <div data-pdf-block="1" className="dg-steel dg-rise border-l-[8px] border-l-plate-yellow p-5">
                <h3 className="flex items-center gap-2 font-bold text-yellow-300">
                  <WarnIcon />
                  검토 알림
                </h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-steel-200 marker:text-yellow-300">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div data-pdf-block="1" className="dg-steel p-6">
              <h3 className="font-display text-2xl text-chalk">AI 상세 상담 카드</h3>
              <div className="dg-whiteboard mt-4 p-4">
                <p className="font-pen text-3xl leading-none text-board-red">핵심 3줄 요약</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm marker:text-board-blue">
                  {summaryLines.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {consultationSections.map((section, sIdx) => {
                  const visual = sectionVisual(section.key);
                  const digest = buildSectionDigest(section.key, section.content, result);
                  return (
                    <div
                      data-pdf-block="1"
                      key={section.key}
                      className={`dg-well dg-rise border-l-[6px] p-5 ${visual.stripe}`}
                      style={{ animationDelay: `${Math.min(sIdx, 10) * 50}ms` }}
                    >
                      <p className={`text-sm font-bold ${visual.titleClass}`}>[{visual.tag}] {section.title}</p>
                      <p className="mt-2 text-xs leading-relaxed text-steel-400">{sectionHelper(section.key)}</p>
                      <div className="mt-4 rounded border border-steel-700 bg-steel-800 p-4">
                        <p className="text-xs font-bold text-steel-400">한 줄 결론</p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-chalk">{digest.summary}</p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {digest.items.map((item, idx) => (
                          <div key={`${section.key}-${idx}`} className="flex gap-3 rounded border border-steel-700 bg-steel-800 p-3">
                            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-black font-num text-sm font-black ${visual.badgeClass}`}>
                              {idx + 1}
                            </div>
                            <p className="text-sm leading-relaxed text-steel-100">{item}</p>
                          </div>
                        ))}
                      </div>
                      <details className="ai-raw-snippet group mt-4 rounded border border-steel-700 bg-steel-900 p-3">
                        <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-2 text-xs font-bold text-steel-300 hover:text-chalk">
                          <Chevron />
                          원문 보기
                        </summary>
                        <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-steel-200">{section.content}</pre>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>

            <details data-pdf-block="1" className="ai-full-raw dg-steel group p-6">
              <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-2 text-lg font-semibold text-steel-200 hover:text-chalk">
                <Chevron />
                원문 전체 펼쳐보기
              </summary>
              <p className="mt-2 text-sm text-steel-400">필요할 때만 전체 상담 문장을 확인하세요.</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-steel-100">{normalizedConsultation}</pre>
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
    case "overall":
      return "\ubd84\uc11d \uc804\uccb4\ub97c \ud55c \ubb38\uc7a5\uc73c\ub85c \uba3c\uc800 \uc774\ud574\ud558\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "diagnosis":
      return "\uc9c0\uae08 \ubab8 \uc0c1\ud0dc\uac00 \uc5b4\ub5a4 \uacbd\ud5a5\uc778\uc9c0 \ub0c9\uc815\ud558\uac8c \uc77d\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "metrics":
      return "\uac01 \uc218\uce58\uac00 \ubb34\uc5c7\uc744 \ub73b\ud558\ub294\uc9c0 \uc0ac\ub78c\ub9d0\ub85c \ud480\uc5b4 \uc124\uba85\ud569\ub2c8\ub2e4.";
    case "strengths":
      return "\ud604\uc7ac \ubab8\uc5d0\uc11c \uc720\uc9c0\ud560 \ub9cc\ud55c \uc7a5\uc810\ub9cc \ucd94\ub824\uc11c \ubcf4\uc5ec\uc90d\ub2c8\ub2e4.";
    case "issues":
      return "\uac00\uc7a5 \uba3c\uc800 \uc190\ubd10\uc57c \ud560 \ubb38\uc81c\ub97c \uc6b0\uc120\uc21c\uc704\ub85c \uc815\ub9ac\ud569\ub2c8\ub2e4.";
    case "priority":
      return "\ubb34\uc5c7\ubd80\ud130 \uc190\ub300\uc57c \ud558\ub294\uc9c0 \uc21c\uc11c\ub97c \uc9da\uc5b4\uc8fc\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "plan":
      return "\uc6b4\ub3d9, \uc2dd\ub2e8, \uc0dd\ud65c\uc2b5\uad00\uc744 \ubc14\ub85c \uc2e4\ud589\ud560 \uc218 \uc788\uac8c \uc815\ub9ac\ud569\ub2c8\ub2e4.";
    case "exercisePlan":
      return "\uc6b4\ub3d9\uc5d0\uc11c \ub2f9\uc7a5 \uc2dc\uc791\ud560 \ud575\uc2ec \ub8e8\ud2f4\uc744 \uc694\uc57d\ud574 \ubcf4\uc5ec\uc90d\ub2c8\ub2e4.";
    case "nutritionPlan":
      return "\uc2dd\ub2e8\uc5d0\uc11c \uac00\uc7a5 \uba3c\uc800 \uc7a1\uc544\uc57c \ud560 \uc2e4\ud589 \ud3ec\uc778\ud2b8\ub97c \uc815\ub9ac\ud569\ub2c8\ub2e4.";
    case "lifestylePlan":
      return "\uc218\uba74, \ud68c\ubcf5, \ud65c\ub3d9\ub7c9 \uac19\uc740 \uc0dd\ud65c\uc2b5\uad00 \uc870\uc815 \ud3ec\uc778\ud2b8\ub97c \ubaa8\uc544\uc11c \ubcf4\uc5ec\uc90d\ub2c8\ub2e4.";
    case "riskSignals":
      return "\ubb34\ub9ac\ud558\uac70\ub098 \ubc29\ud5a5\uc744 \uc798\ubabb \uc7a1\uc744 \ub54c \ub098\uc624\ub294 \uacbd\uace0 \uc2e0\ud638\ub97c \ubcf4\uc5ec\uc90d\ub2c8\ub2e4.";
    case "misconceptions":
      return "\ucd08\ubcf4\uc790\uac00 \ud5f7\uac08\ub9ac\uae30 \uc26c\uc6b4 \ud574\uc11d \uc2e4\uc218\ub97c \uba3c\uc800 \uc9da\uc5b4\uc90d\ub2c8\ub2e4.";
    case "donts":
      return "\ud6a8\uacfc\ub97c \ub5a8\uc5b4\ub728\ub9ac\uac70\ub098 \uba38\ub9ac\ub97c \ud5f7\uac08\ub9ac\uac8c \ud558\ub294 \uae08\uc9c0 \uc0ac\ud56d\uc744 \uc815\ub9ac\ud569\ub2c8\ub2e4.";
    case "fourWeeks":
      return "\uc55e\uc73c\ub85c 4\uc8fc \ub3d9\uc548 \uc5b4\ub5bb\uac8c \uc6c0\uc9c1\uc77c\uc9c0 \uc8fc\ucc28\ubcc4\ub85c \uc548\ub0b4\ud569\ub2c8\ub2e4.";
    case "nextCheck":
      return "\ub2e4\uc74c \uce21\uc815 \ub54c \uc5b4\ub5a4 \uc218\uce58\ub97c \uc911\uc810\uc801\uc73c\ub85c \ubcfc\uc9c0 \uc815\ub9ac\ud569\ub2c8\ub2e4.";
    case "current":
      return "\ud604\uc7ac \uccb4\ud615\uacfc \uac74\uac15 \uc0c1\ud0dc\ub97c \uc26c\uc6b4 \ub9d0\ub85c \ud480\uc5b4 \uc77d\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "goal":
      return "\uba87 \uc8fc \ub3d9\uc548 \uc5b4\ub5a4 \uc218\uce58\ub97c \uc5b4\ub514\uae4c\uc9c0 \ubc14\uafb8\ub294\uc9c0 \ubcf4\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "nutrition":
      return "\ud558\ub8e8 \uc2dd\uc0ac\ub7c9\uacfc \ud0c4\ub2e8\uc9c0 \uade0\ud615\uc744 \uc774\ud574\ud558\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "exercise":
      return "\uc2e4\uc81c\ub85c \uc5b4\ub5a4 \uc6b4\ub3d9\uc744 \uc5b4\ub290 \uc815\ub3c4 \ud560\uc9c0 \ubcf4\ub294 \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "checkpoint":
      return "\uc8fc\ucc28\ubcc4\ub85c \ubb34\uc5c7\uc744 \uc810\uac80\ud574\uc57c \ud558\ub294\uc9c0 \uc815\ub9ac\ud55c \uad6c\uac04\uc785\ub2c8\ub2e4.";
    case "caution":
      return "\ubb34\ub9ac\ud558\uc9c0 \uc54a\uae30 \uc704\ud574 \uaf2d \ud655\uc778\ud574\uc57c \ud558\ub294 \uc8fc\uc758\uc810\uc785\ub2c8\ub2e4.";
    default:
      return "\uc0c1\ub2f4 \ub0b4\uc6a9\uc744 \uc21c\uc11c\ub300\ub85c \uc77d\uc5b4 \ub0b4\ub824\uac00\uba74 \ub429\ub2c8\ub2e4.";
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

const SECTION_TONES = {
  red: { stripe: "border-l-plate-red", stripeTop: "border-t-plate-red", titleClass: "text-red-300", badgeClass: "bg-plate-red text-white" },
  yellow: { stripe: "border-l-plate-yellow", stripeTop: "border-t-plate-yellow", titleClass: "text-yellow-300", badgeClass: "bg-plate-yellow text-black" },
  green: { stripe: "border-l-plate-green", stripeTop: "border-t-plate-green", titleClass: "text-green-300", badgeClass: "bg-plate-green text-black" },
  blue: { stripe: "border-l-plate-blue", stripeTop: "border-t-plate-blue", titleClass: "text-blue-300", badgeClass: "bg-plate-blue text-white" },
  steel: { stripe: "border-l-steel-600", stripeTop: "border-t-steel-600", titleClass: "text-steel-200", badgeClass: "bg-steel-600 text-chalk" },
} as const;

// 섹션 색: 빨강 = 경고/우선, 노랑 = 주의/강조, 초록 = 좋은 점/실행, 파랑 = 진단/정보
function sectionVisual(key: string) {
  const tone = (tag: string, color: keyof typeof SECTION_TONES) => ({ tag, ...SECTION_TONES[color] });
  switch (key) {
    case "overall":
      return tone("총평", "yellow");
    case "diagnosis":
      return tone("진단", "blue");
    case "metrics":
      return tone("해석", "blue");
    case "strengths":
      return tone("강점", "green");
    case "issues":
      return tone("우선", "red");
    case "priority":
      return tone("순서", "red");
    case "plan":
      return tone("실행", "yellow");
    case "exercisePlan":
      return tone("운동", "blue");
    case "nutritionPlan":
      return tone("식단", "green");
    case "lifestylePlan":
      return tone("생활", "green");
    case "riskSignals":
      return tone("경고", "red");
    case "misconceptions":
      return tone("오해", "yellow");
    case "donts":
      return tone("금지", "red");
    case "fourWeeks":
      return tone("4주", "green");
    case "nextCheck":
      return tone("체크", "yellow");
    case "current":
      return tone("현재", "blue");
    case "goal":
      return tone("목표", "red");
    case "nutrition":
      return tone("식단", "green");
    case "exercise":
      return tone("운동", "blue");
    case "checkpoint":
      return tone("체크", "yellow");
    case "caution":
      return tone("주의", "yellow");
    default:
      return tone("상담", "steel");
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
  consultationSectionRules.forEach((r) => bucket.set(r.key, []));

  let currentKey = "diagnosis";
  for (const line of lines) {
    const headingKey = detectSectionHeadingKey(line);
    if (headingKey) {
      currentKey = headingKey;
      continue;
    }
    bucket.get(currentKey)?.push(line);
  }

  const sections = consultationSectionRules
    .map((rule) => ({ key: rule.key, title: rule.title, content: (bucket.get(rule.key) || []).join("\n") }))
    .filter((s) => s.content.trim().length > 0);

  if (sections.length === 0) return [{ key: "full", title: "상담 내용", content: text || "-" }];
  return sections;
}

function detectSectionHeadingKey(line: string) {
  const normalized = line
    .toLowerCase()
    .replace(/^[\[\(]?[0-9]+[.)\]]?\s*/, "")
    .replace(/[\uFF1A:]/g, "")
    .replace(/\s+/g, "");

  const headingMap: Array<{ key: string; aliases: string[] }> = [
    { key: "overall", aliases: ["\ud55c\uc904\ucd1d\ud3c9", "\ucd1d\ud3c9", "\uc694\uc57d\uacb0\ub860"] },
    { key: "diagnosis", aliases: ["\ud604\uc7ac\ubab8\uc0c1\ud0dc\uc9c4\ub2e8", "\ud604\uc7ac\ubab8\uc0c1\ud0dc", "\uc0c1\ud0dc\uc9c4\ub2e8", "\uc9c4\ub2e8"] },
    { key: "metrics", aliases: ["\ud56d\ubaa9\ubcc4\ud574\uc11d", "\uc218\uce58\ud574\uc11d", "\uc9c0\ud45c\ud574\uc11d"] },
    { key: "strengths", aliases: ["\uc88b\uc740\uc810", "\uac15\uc810"] },
    { key: "issues", aliases: ["\ubd80\uc871\ud55c\uc810/\uc2dc\uae09\ud55c\ubb38\uc81c", "\ubd80\uc871\ud55c\uc810", "\uc2dc\uae09\ud55c\ubb38\uc81c", "\ubb38\uc81c\uc810", "\uc6b0\uc120\uc21c\uc704"] },
    { key: "plan", aliases: ["\uc5b4\ub5bb\uac8c\ud574\uc57c\ud558\ub294\uc9c0", "\uc2e4\ud589\uacc4\ud68d", "\uc6b4\ub3d9", "\uc2dd\ub2e8", "\uc0dd\ud65c\uc2b5\uad00"] },
    { key: "fourWeeks", aliases: ["4\uc8fc\ud589\ub3d9\uac00\uc774\ub4dc", "4\uc8fc\uac00\uc774\ub4dc", "4\uc8fc\uacc4\ud68d"] },
    { key: "nextCheck", aliases: ["\ub2e4\uc74c\uc778\ubc14\ub514\uccb4\ud06c\ud3ec\uc778\ud2b8", "\uccb4\ud06c\ud3ec\uc778\ud2b8", "\ub2e4\uc74c\uce21\uc815"] },
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

function buildCombinedConsultationSections(result: InbodyResponse, normalizedConsultation: string) {
  const structured = buildStructuredConsultationSections(result);
  const parsed = buildConsultationSections(normalizedConsultation);

  if (structured.length === 0) {
    return parsed;
  }

  const seen = new Set(structured.map((section) => section.key));
  return [...structured, ...parsed.filter((section) => !seen.has(section.key))];
}

function buildStructuredConsultationSections(result: InbodyResponse): ConsultationSection[] {
  const structured = result.structuredReport || {};
  const order: Array<{ key: string; title: string; sourceKey: string }> = [
    { key: "overall", title: "한 줄 총평", sourceKey: "overall" },
    { key: "diagnosis", title: "현재 몸 상태 진단", sourceKey: "diagnosis" },
    { key: "priority", title: "우선순위", sourceKey: "priority_order" },
    { key: "issues", title: "부족한 점 / 시급한 문제", sourceKey: "issues" },
    { key: "exercisePlan", title: "운동 계획", sourceKey: "exercise_plan" },
    { key: "nutritionPlan", title: "식단 계획", sourceKey: "nutrition_plan" },
    { key: "lifestylePlan", title: "생활습관 계획", sourceKey: "lifestyle_plan" },
    { key: "riskSignals", title: "위험 신호", sourceKey: "risk_signals" },
    { key: "misconceptions", title: "오해하기 쉬운 포인트", sourceKey: "misconceptions" },
    { key: "donts", title: "하지 말아야 할 것", sourceKey: "donts" },
  ];

  return order
    .map((item) => ({
      key: item.key,
      title: item.title,
      content: (structured[item.sourceKey] || "").trim(),
    }))
    .filter((item) => item.content.length > 0);
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
    case "overall":
      return {
        summary: `\ud604\uc7ac \uccb4\uc911 ${weight}kg, \uace8\uaca9\uadfc\ub7c9 ${muscle}kg, \uccb4\uc9c0\ubc29\ub960 ${bodyFat}% \uae30\uc900\uc73c\ub85c \ubab8 \uc0c1\ud0dc\ub97c \uba3c\uc800 \uc774\ud574\ud558\uba74 \ub429\ub2c8\ub2e4.`,
        items: [
          "\uc9c0\uae08\uc740 \uccb4\uc911 \uc22b\uc790 \ud558\ub098\ubcf4\ub2e4 \uadfc\uc721\ub7c9\uacfc \uccb4\uc9c0\ubc29 \uade0\ud615\uc744 \uac19\uc774 \ubcf4\ub294 \ud3b8\uc774 \ub354 \uc911\uc694\ud569\ub2c8\ub2e4.",
          "\uadf9\ub2e8\uc801\uc778 \uac10\ub7c9\ubcf4\ub2e4 \uccb4\uc131\ubd84\uc744 \ucc9c\ucc9c\ud788 \uac1c\uc120\ud558\ub294 \ubc29\ud5a5\uc73c\ub85c \ud574\uc11d\ud558\ub294 \uac83\uc774 \ud604\uc2e4\uc801\uc785\ub2c8\ub2e4.",
        ],
      };
    case "diagnosis":
      return {
        summary: `\ud604\uc7ac \uc218\uce58\uc0c1 \uccb4\uc9c0\ubc29\ub960 ${bodyFat}%\uc640 \uace8\uaca9\uadfc\ub7c9 ${muscle}kg\ub97c \ud568\uaed8 \ubcf4\uba74 \ubab8 \uad6c\uc131\uc758 \ubc29\ud5a5\uc744 \uc77d\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4.`,
        items: [
          "\uccb4\uc911\uc774 \uc815\uc0c1\ucc98\ub7fc \ubcf4\uc5ec\ub3c4 \uadfc\uc721\uc774 \ubd80\uc871\ud558\uba74 \uc2e4\uc81c \uccb4\ud615\uc740 \uae30\ub300\ubcf4\ub2e4 \ud0c4\ud0c4\ud558\uc9c0 \uc54a\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
          "\ubc18\ub300\ub85c \uccb4\uc911\uc774 \ub192\uc544\ub3c4 \uadfc\uc721\ub7c9\uc774 \ubc1b\uccd0\uc8fc\uba74 \uac10\ub7c9\ubcf4\ub2e4 \uad6c\uc131 \uc870\uc815\uc774 \uba3c\uc800\uc77c \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
        ],
      };
    case "metrics":
      return {
        summary: "\uac01 \uc218\uce58\ub294 \ub530\ub85c \ubcf4\uc9c0 \ub9d0\uace0 \uc11c\ub85c \uc5f0\uacb0\ud574\uc11c \uc77d\uc5b4\uc57c \ud574\uc11d\uc774 \uc815\ud655\ud574\uc9d1\ub2c8\ub2e4.",
        items: [
          "\uace8\uaca9\uadfc\ub7c9\uc740 \ubab8\uc744 \uc6c0\uc9c1\uc774\ub294 \uadfc\uc721 \uae30\ubc18\uc774 \uc5b4\ub290 \uc815\ub3c4\uc778\uc9c0 \ubcf4\uc5ec\uc90d\ub2c8\ub2e4.",
          "\uccb4\uc9c0\ubc29\ub960\uc740 \uac10\ub7c9 \ud544\uc694\uc131\uacfc \uc2dd\ub2e8 \uad00\ub9ac \uac15\ub3c4\ub97c \ud310\ub2e8\ud558\ub294 \uae30\uc900\uc774 \ub429\ub2c8\ub2e4.",
          "BMI\ub294 \ucc38\uace0\uc6a9\uc774\uace0, \uc2e4\uc81c \ubab8 \uc0c1\ud0dc\ub294 \uadfc\uc721\uacfc \uc9c0\ubc29 \ube44\uc728\uc744 \uac19\uc774 \ubd10\uc57c \ub354 \uc815\ud655\ud569\ub2c8\ub2e4.",
        ],
      };
    case "strengths":
      return {
        summary: "\ud604\uc7ac \uc218\uce58 \uc548\uc5d0\uc11c\ub3c4 \uc720\uc9c0\ud558\uac70\ub098 \uc0b4\ub9b4 \ub9cc\ud55c \uc694\uc18c\ub294 \ubd84\uba85\ud788 \uc788\uc2b5\ub2c8\ub2e4.",
        items: [
          "\ud55c \ud56d\ubaa9\uc774\ub77c\ub3c4 \uc548\uc815\uc801\uc73c\ub85c \uc720\uc9c0\ub418\uace0 \uc788\ub2e4\uba74 \uadf8 \ubd80\ubd84\uc740 \ud604\uc7ac \ub8e8\ud2f4\uc758 \uc7a5\uc810\uc77c \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
          "\uc88b\uc740 \uc810\uc740 \uacfc\uc7a5\ud558\uc9c0 \uc54a\uace0, \ub2e4\uc74c \ub2e8\uacc4\uc5d0\uc11c \uacc4\uc18d \uac00\uc838\uac08 \uae30\ubc18\uc73c\ub85c \ubcf4\uba74 \ub429\ub2c8\ub2e4.",
        ],
      };
    case "issues":
      return {
        summary: "\uac00\uc7a5 \uba3c\uc800 \uace0\ccd0\uc57c \ud560 \ubb38\uc81c\ub97c \uba3c\uc800 \uc7a1\uc544\uc57c \ubcc0\ud654\uac00 \ube68\ub77c\uc9d1\ub2c8\ub2e4.",
        items: [
          "\uadfc\uc721\ub7c9 \ubd80\uc871\uc740 \uccb4\ud615 \ubcc0\ud654 \uc18d\ub3c4\ub97c \ub2a6\ucd94\ub294 \ub300\ud45c \uc6d0\uc778\uc785\ub2c8\ub2e4.",
          "\uccb4\uc9c0\ubc29\uc774 \ub192\ub2e4\uba74 \uc6b4\ub3d9\ubcf4\ub2e4 \uc2dd\ub2e8 \uc548\uc815\ud654\uac00 \uba3c\uc800 \ud6a8\uacfc\ub97c \ub0b4\ub294 \uacbd\uc6b0\uac00 \ub9ce\uc2b5\ub2c8\ub2e4.",
          "\ud55c \ubc88\uc5d0 \ub2e4 \ubc14\uafb8\uae30\ubcf4\ub2e4 \uac00\uc7a5 \ud070 \ubb38\uc81c \ud558\ub098\ubd80\ud130 \ud574\uacb0\ud558\ub294 \ud3b8\uc774 \uc624\ub798 \uac11\ub2c8\ub2e4.",
        ],
      };
    case "priority":
      return {
        summary: "\uc6b0\uc120\uc21c\uc704\uac00 \uc120\uba85\ud574\uc57c \uc2e4\uc81c \uc2e4\ud589\ub825\uc774 \uc0dd\uae41\ub2c8\ub2e4.",
        items: [
          "1\uc21c\uc704\ub294 \uac00\uc7a5 \ud070 \ubb38\uc81c\ub97c \uc7a1\ub294 \uac83\uc774\uace0, \ub098\uba38\uc9c0\ub294 \uadf8 \ub2e4\uc74c\uc785\ub2c8\ub2e4.",
          "\ubaa8\ub4e0 \uac83\uc744 \ub3d9\uc2dc\uc5d0 \ubc14\uafb8\ub824\uace0 \ud558\uba74 \uc624\ud788\ub824 \uc720\uc9c0\uac00 \uc5b4\ub835\uc2b5\ub2c8\ub2e4.",
          "\uccb4\uc911, \uccb4\uc9c0\ubc29, \uadfc\uc721, \uc2b5\uad00 \uc911 \ubb34\uc5c7\uc744 \uba3c\uc800 \uc190\ub300\uc57c \ud558\ub294\uc9c0 \uad6c\ubd84\ud574\uc57c \ud569\ub2c8\ub2e4.",
        ],
      };
    case "plan":
      return {
        summary: `\ud558\ub8e8 \uc12d\ucde8\ub294 \uc57d ${calories}kcal, \ub2e8\ubc31\uc9c8\uc740 ${protein}g \uae30\uc900\uc73c\ub85c \ub9de\ucd94\uba74 \uc2e4\ud589\ud558\uae30 \ud3b8\ud569\ub2c8\ub2e4.`,
        items: [
          "\uc6b4\ub3d9\uc740 \uc8fc 3\ud68c \uc815\ub3c4\uc758 \uae30\ubcf8 \uadfc\ub825\uc6b4\ub3d9\ubd80\ud130 \uace0\uc815\ud558\ub294 \uac83\uc774 \ud604\uc2e4\uc801\uc785\ub2c8\ub2e4.",
          "\uc2dd\ub2e8\uc740 \uc644\ubcbd\ud568\ubcf4\ub2e4 \uacfc\uc2dd\uacfc \uc57c\uc2dd\uc744 \uc904\uc774\uace0 \ub2e8\ubc31\uc9c8\uc744 \uafb8\uc900\ud788 \ucc44\uc6b0\ub294 \ucabd\uc774 \ub354 \uc911\uc694\ud569\ub2c8\ub2e4.",
          "\uc0dd\ud65c\uc2b5\uad00\uc5d0\uc11c\ub294 \uc218\uba74, \uc218\ubd84, \ud65c\ub3d9\ub7c9\uc744 \uba3c\uc800 \uc548\uc815\uc2dc\ud0a4\ub294 \uac83\uc774 \uccb4\uc131\ubd84 \ubcc0\ud654\uc5d0 \uc9c1\uc811\uc801\uc785\ub2c8\ub2e4.",
        ],
      };
    case "exercisePlan":
      return {
        summary: "\uc6b4\ub3d9\uc740 \ubcf5\uc7a1\ud55c \uae30\uc220\ubcf4\ub2e4 \uba3c\uc800 \ub8e8\ud2f4\uc744 \uace0\uc815\ud558\ub294 \uac83\uc774 \uc6b0\uc120\uc785\ub2c8\ub2e4.",
        items: [
          "\uc8fc 3\ud68c \uae30\ubcf8 \uadfc\ub825\uc6b4\ub3d9\uc744 \uc815\ud574 \ub193\uace0 \ube7c\ubbc0\ub294 \uc8fc\ub97c \uc904\uc774\uc138\uc694.",
          "\uadfc\ub825\uc6b4\ub3d9\uc740 \uc790\uc138\uc640 \uc9c0\uc18d\uc131\uc744 \uc6b0\uc120\ud558\uace0 \uc720\uc0b0\uc18c\ub294 \ubcf4\uc870 \uac1c\ub150\uc73c\ub85c \ubd99\uc774\ub294 \ud3b8\uc774 \uc88b\uc2b5\ub2c8\ub2e4.",
          "\ucc98\uc74c\ubd80\ud130 \uacfc\ud55c \ubd84\ud560 \ub8e8\ud2f4\uc744 \uc9dc\uba74 \uc624\ud788\ub824 \uc720\uc9c0\uac00 \uc5b4\ub835\uc2b5\ub2c8\ub2e4.",
        ],
      };
    case "nutritionPlan":
      return {
        summary: `\uc2dd\ub2e8\uc740 \uce7c\ub85c\ub9ac ${calories}kcal\uc640 \ub2e8\ubc31\uc9c8 ${protein}g \uae30\uc900\uc744 \uc9c0\uc18d \uac00\ub2a5\ud558\uac8c \ub9de\ucd94\ub294 \uac83\uc774 \ud575\uc2ec\uc785\ub2c8\ub2e4.`,
        items: [
          "\ud55c \ubc88\uc5d0 \uc2dd\ub2e8\uc744 \uc644\ubcbd\ud558\uac8c \ubc14\uafb8\uae30\ubcf4\ub2e4 \uacfc\uc2dd, \uc57c\uc2dd, \ub2e8\ubc31\uc9c8 \ubd80\uc871\ubd80\ud130 \uc815\ub9ac\ud558\uc138\uc694.",
          "\ub2e8\ubc31\uc9c8\uc740 \ub07c\ub2c8\ub9c8\ub2e4 \ub098\ub220 \ucc44\uc6b0\uace0, \ud0c4\uc218\ud654\ubb3c\uc740 \uc6b4\ub3d9\uacfc \ud65c\ub3d9\ub7c9\uc5d0 \ub9de\ucdb0 \uc870\uc808\ud558\ub294 \ud3b8\uc774 \uc88b\uc2b5\ub2c8\ub2e4.",
          "\uadf9\ub2e8\uc801\uc778 \uc800\uc5f4\ub7c9 \uc2dd\ub2e8\uc740 \uc7a5\uae30\uc801\uc73c\ub85c \uc720\uc9c0\ud558\uae30 \uc5b4\ub835\uc2b5\ub2c8\ub2e4.",
        ],
      };
    case "lifestylePlan":
      return {
        summary: "\uc0dd\ud65c\uc2b5\uad00\uc740 \ub208\uc5d0 \uc798 \uc548 \ubcf4\uc774\uc9c0\ub9cc \uccb4\uc131\ubd84 \ubcc0\ud654\ub97c \uac00\ub974\ub294 \uae30\ubcf8 \ud1a0\ub300\uc785\ub2c8\ub2e4.",
        items: [
          "\uc218\uba74 \uc2dc\uac04\uacfc \uc218\uba74 \ud488\uc9c8\uc744 \uba3c\uc800 \uc548\uc815\uc2dc\ud0a4\uba74 \ud53c\ub85c \ub204\uc801\uc774 \uc904\uc5b4\ub4ed\ub2c8\ub2e4.",
          "\ubb3c, \uac78\uc74c \uc218, \ud65c\ub3d9\ub7c9 \uac19\uc740 \uae30\ubcf8 \ud65c\ub3d9 \uc9c0\ud45c\ub97c \ud568\uaed8 \ubcf4\uba74 \ubcc0\ud654\ub97c \uc720\uc9c0\ud558\uae30 \uc27d\uc2b5\ub2c8\ub2e4.",
          "\uc8fc\ub9d0\ub9c8\ub2e4 \ubb34\ub108\uc9c0\ub294 \ud328\ud134\uc774 \uc788\ub2e4\uba74 \ud3c9\uc77c \ub178\ub825\ub3c4 \ud6a8\uc728\uc774 \ub5a8\uc5b4\uc9d1\ub2c8\ub2e4.",
        ],
      };
    case "riskSignals":
      return {
        summary: "\uc704\ud5d8 \uc2e0\ud638\ub294 \ube68\ub9ac \ubc14\ub01c \uac83\ucc98\ub7fc \ubcf4\uc774\ub354\ub77c\ub3c4 \uacb0\uad6d \uc5ed\ud6a8\uacfc\ub97c \ubd80\ub974\uae30 \uc27d\uc2b5\ub2c8\ub2e4.",
        items: [
          "\ud53c\ub85c \ub204\uc801, \ud68c\ubcf5 \uc9c0\uc5f0, \ud1b5\uc99d \ubb34\uc2dc\ub294 \uc6b4\ub3d9 \ubc29\ud5a5\uc744 \uc7ac\uc870\uc815\ud574\uc57c \ud560 \uc2e0\ud638\uc77c \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
          "\uccb4\uc911\uc774 \uae09\uac8c \ubc14\ub00c\ub354\ub77c\ub3c4 \ucee8\ub514\uc158\uc774 \ub098\ube60\uc9c0\uba74 \uc88b\uc740 \ubcc0\ud654\ub85c \ubcf4\uae30 \uc5b4\ub835\uc2b5\ub2c8\ub2e4.",
          "\ud611\uc624 \uae30\ubc18\uc758 \uc2dd\ub2e8\uc774\ub098 \uac15\ubc15\uc801\uc778 \uc6b4\ub3d9 \ud328\ud134\uc740 \uc624\ub798 \uac00\uc9c0 \ubabb\ud569\ub2c8\ub2e4.",
        ],
      };
    case "misconceptions":
      return {
        summary: "\uccb4\uc911 \uc22b\uc790 \ud558\ub098\ub85c \ubaa8\ub4e0 \ubcc0\ud654\ub97c \ud310\ub2e8\ud558\uba74 \ud574\uc11d\uc774 \uc5b4\uae0b\ub098\uae30 \uc27d\uc2b5\ub2c8\ub2e4.",
        items: [
          "\uac19\uc740 \uccb4\uc911\uc774\ub77c\ub3c4 \uace8\uaca9\uadfc\ub7c9\uacfc \uccb4\uc9c0\ubc29\ub960\uc5d0 \ub530\ub77c \ubab8 \uc0c1\ud0dc\ub294 \uc804\ud600 \ub2e4\ub974\uac8c \ubcf4\uc77c \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
          "\ub2e8\uae30\uc5d0 \uccb4\uc911\uc774 \uc904\uc5b4\ub3c4 \uadfc\uc721\uae4c\uc9c0 \ud568\uaed8 \ube60\uc84c\ub2e4\uba74 \uc88b\uc740 \uac10\ub7c9\uc774 \uc544\ub2d0 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
          "\uc778\ubc14\ub514\ub294 \ud55c \ud56d\ubaa9\uc774 \uc544\ub2c8\ub77c \uc5ec\ub7ec \uc218\uce58\ub97c \ud568\uaed8 \ubd10\uc57c \uc758\ubbf8\uac00 \uc0b4\uc544\ub0a9\ub2c8\ub2e4.",
        ],
      };
    case "donts":
      return {
        summary: "\ube68\ub9ac \ubc14\ub00c\uaca0\ub2e4\uace0 \ubb34\ub9ac\ud558\ub294 \ubc29\uc2dd\uc740 \uc624\ud788\ub824 \uacb0\uacfc\ub97c \ub9dd\uce60 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
        items: [
          "\ubb34\ub9ac\ud55c \uc808\uc2dd\uacfc \uacfc\ub3c4\ud55c \uc720\uc0b0\uc18c\ub9cc\uc73c\ub85c \ubc84\ud2f0\ub294 \ubc29\uc2dd\uc740 \ud53c\ud558\ub294 \ud3b8\uc774 \uc88b\uc2b5\ub2c8\ub2e4.",
          "\uc218\uba74\uc774 \ubb34\ub108\uc9c4 \uc0c1\ud0dc\uc5d0\uc11c \uc6b4\ub3d9\ub7c9\ub9cc \uacc4\uc18d \ub298\ub9ac\ub294 \ubc29\uc2dd\uc740 \ud68c\ubcf5\uc744 \ub354 \ub2a6\ucd25\ub2c8\ub2e4.",
          "\ubcf4\ucda9\uc81c\ub098 \ub2e8\uae30 \ubcc0\ud654\uc5d0\ub9cc \uc758\uc874\ud558\uace0 \uae30\ubcf8 \uc2dd\uc0ac\uc640 \ub8e8\ud2f4\uc744 \ub193\uce58\uba74 \uc9c0\uc18d\ud558\uae30 \uc5b4\ub835\uc2b5\ub2c8\ub2e4.",
        ],
      };
    case "fourWeeks":
      return {
        summary: firstWeek?.focus ? `\uccab \uc8fc \ud575\uc2ec\uc740 '${firstWeek.focus}'\uc785\ub2c8\ub2e4.` : "\uc55e\uc73c\ub85c 4\uc8fc\ub294 \ub8e8\ud2f4\uc744 \ub9cc\ub4e4\uace0 \ubab8\uc744 \uc801\uc751\uc2dc\ud0a4\ub294 \uae30\uac04\uc73c\ub85c \ubcf4\uba74 \ub429\ub2c8\ub2e4.",
        items: [
          "1\uc8fc\ucc28\uc5d0\ub294 \uc6b4\ub3d9 \ud69f\uc218\uc640 \uc2dd\uc0ac \ub9ac\ub4ec\uc744 \uace0\uc815\ud558\ub294 \ub370 \uc9d1\uc911\ud558\uc138\uc694.",
          "2\uc8fc\ucc28\uc5d0\ub294 \ub2e8\ubc31\uc9c8\uacfc \uc218\uba74 \uc2dc\uac04\uc744 \uc870\uae08 \ub354 \uc548\uc815\uc801\uc73c\ub85c \ub9de\ucd94\uc138\uc694.",
          "3~4\uc8fc\ucc28\uc5d0\ub294 \uccb4\uc911\ubcf4\ub2e4 \uadfc\uc721\ub7c9\uacfc \uccb4\uc9c0\ubc29\ub960 \ubcc0\ud654\ub97c \ud568\uaed8 \ud655\uc778\ud558\uc138\uc694.",
        ],
      };
    case "nextCheck":
      return {
        summary: "\ub2e4\uc74c \uc778\ubc14\ub514\uc5d0\uc11c\ub294 \uccb4\uc911\ubcf4\ub2e4 \uccb4\uc131\ubd84 \ubcc0\ud654\uac00 \ub354 \uc911\uc694\ud569\ub2c8\ub2e4.",
        items: [
          "\uace8\uaca9\uadfc\ub7c9\uc774 \uc720\uc9c0\ub418\uac70\ub098 \ub298\uc5c8\ub294\uc9c0 \uba3c\uc800 \ud655\uc778\ud558\uc138\uc694.",
          "\uccb4\uc9c0\ubc29\ub960\uc774 \uc904\uc5c8\ub294\uc9c0 \ud568\uaed8 \uccb4\ud06c\ud558\uc138\uc694.",
          "\uac19\uc740 \uccb4\uc911\uc774\ub77c\ub3c4 \ubab8 \uad6c\uc131\uc774 \uc88b\uc544\uc84c\ub294\uc9c0 \ubcf4\ub294 \uc2b5\uad00\uc774 \uc911\uc694\ud569\ub2c8\ub2e4.",
        ],
      };
    default:
      return {
        summary: "\ud575\uc2ec \ub0b4\uc6a9\uc744 \uba3c\uc800 \uc77d\uace0 \ud544\uc694\ud560 \ub54c\ub9cc \uc6d0\ubb38\uc744 \ud3bc\uccd0\uc11c \ud655\uc778\ud574 \uc8fc\uc138\uc694.",
        items: ["\uc774 \ud654\uba74\uc740 \ucd08\ubcf4\uc790\ub3c4 \ube60\ub974\uac8c \uc774\ud574\ud560 \uc218 \uc788\ub3c4\ub85d \ud575\uc2ec\ub9cc \uba3c\uc800 \ubcf4\uc5ec\uc90d\ub2c8\ub2e4."],
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
  return { badge, headline, description, toneClass: "bg-plate-green text-black" };
}

function cautionInsight(badge: string, headline: string, description: string): MetricInsight {
  return { badge, headline, description, toneClass: "bg-plate-yellow text-black" };
}

function neutralInsight(headline: string, description: string): MetricInsight {
  return { badge: "확인 필요", headline, description, toneClass: "bg-steel-700 text-chalk" };
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
    <span className={`dg-chip text-sm ${warning ? "dg-pop bg-plate-yellow text-black" : "bg-steel-700 text-chalk"}`}>
      {warning && <WarnIcon />}
      {label}
    </span>
  );
}

// 차트 카드: 화면에 들어오는 순간 차트를 다시 그려 막대가 차오르게 한다.
// 화면 밖에서도 차트는 완성된 상태로 그려져 있으므로 PDF 캡처에는 영향이 없다.
function ChartCard({ title, children }: { title: string; children: (inView: boolean) => ReactNode }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div ref={ref} className="dg-steel p-5">
      <h3 className="px-1 font-display text-xl text-chalk">{title}</h3>
      <div className="mt-3">{children(inView)}</div>
    </div>
  );
}

function MetricCard({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <div
      className="dg-rise rounded-md border-[3px] border-black bg-steel-800 p-4 shadow-md transition duration-150 hover:-translate-y-0.5 hover:shadow-xl"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs font-semibold text-steel-400">{label}</p>
      <AnimatedValue value={value} className="mt-1 font-num text-2xl font-black text-chalk" />
    </div>
  );
}

// "23.5kg" 처럼 앞자리가 숫자인 값만 0 에서 굴려 올린다. 화면 밖에서는 최종값을 그대로 보여 준다(PDF 캡처 대비).
function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const [ref, inView] = useInView<HTMLParagraphElement>({ threshold: 0 });
  const match = /^(-?\d+(?:\.\d+)?)(.*)$/.exec((value ?? "").trim());
  const target = match ? Number(match[1]) : 0;
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const counted = useCountUp(match ? target : null, { duration: 900, start: inView });
  return (
    <p ref={ref} className={className}>
      {match && inView ? `${counted.toFixed(decimals)}${match[2]}` : value}
    </p>
  );
}

function CountNumber({ value, className }: { value: number; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0 });
  const decimals = Number.isInteger(value) ? 0 : 1;
  const counted = useCountUp(value, { duration: 900, start: inView });
  return (
    <span ref={ref} className={className}>
      {inView ? counted.toFixed(decimals) : value}
    </span>
  );
}

function MacroSwatch({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="inline-block h-3 w-3 rounded-sm border-2 border-black" style={{ background: color }} aria-hidden="true" />
      {label} <CountNumber value={value} className="font-num text-base font-black text-chalk" />g
    </span>
  );
}

function NumberedRow({ index, badgeClass, text }: { index: number; badgeClass: string; text: string }) {
  return (
    <div className="dg-well dg-rise flex gap-3 p-3" style={{ animationDelay: `${100 + index * 50}ms` }}>
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-black font-num text-sm font-black ${badgeClass}`}>
        {index + 1}
      </div>
      <p className="text-sm leading-relaxed text-steel-100">{text}</p>
    </div>
  );
}

// 화이트보드 체크리스트. 체크 표시는 화면에서만 쓰는 표현용 상태다.
function ChecklistBoard({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const toggle = (idx: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  return (
    <div className="dg-whiteboard dg-rise p-6" style={{ animationDelay: "80ms" }}>
      <p className="font-num text-base font-black tracking-wide text-board-blue">Quick Actions</p>
      <h3 className="mt-1 font-pen text-3xl leading-none text-board-red">초보자용 실행 체크리스트</h3>
      <div className="mt-4 space-y-2">
        {items.map((item, idx) => {
          const done = checked.has(idx);
          return (
            <button
              key={`${item}-${idx}`}
              type="button"
              aria-pressed={done}
              onClick={() => toggle(idx)}
              className="dg-rise flex w-full gap-3 rounded-md border-2 border-transparent p-3 text-left transition hover:-translate-y-0.5 hover:border-steel-300 hover:bg-white"
              style={{ animationDelay: `${140 + idx * 50}ms` }}
            >
              <span
                key={done ? "on" : "off"}
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 border-board-ink font-num text-base font-black ${
                  done ? "dg-pop bg-plate-green text-black" : "bg-white text-board-ink"
                }`}
              >
                {done ? <CheckMark className="h-4 w-4" /> : idx + 1}
              </span>
              <span className={`text-sm leading-relaxed ${done ? "text-steel-500 line-through decoration-board-red decoration-2" : "text-board-ink"}`}>
                {item}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5M12 18v.5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

type MacroLabelProps = { x?: number; y?: number; textAnchor?: "start" | "middle" | "end" | "inherit"; name?: string; value?: number };

const renderMacroLabel = (props: MacroLabelProps) => (
  <text
    x={props.x}
    y={props.y}
    fill={CHART.chalkText}
    textAnchor={props.textAnchor}
    dominantBaseline="central"
    style={{ fontFamily: NUM_FONT, fontWeight: 800, fontSize: 15 }}
  >
    {`${props.name} ${props.value}%`}
  </text>
);

const legendText = (value: string) => <span style={{ color: CHART.tick, fontWeight: 700 }}>{value}</span>;

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
