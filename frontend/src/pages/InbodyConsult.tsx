import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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
  const metricInsightCards = useMemo(() => (result ? buildMetricInsightCards(result.metrics) : []), [result]);

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
      const res = await fetch(`${API_BASE}/api/ai/inbody/review-consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metrics: { ...result.metrics, ...confirmedMetrics },
          goal,
          notes,
          goalIntensity,
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
    try {
      const user = safeGetUser();
      const res = await fetch(`${API_BASE}/api/ai/inbody/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          memberName: user?.nickname || user?.email || "User",
          ...result,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inbody-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "PDF 생성 중 오류가 발생했습니다.");
    } finally {
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
      <div className="relative mx-auto max-w-6xl space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-cyan-950/40 p-6 shadow-[0_20px_70px_-30px_rgba(34,211,238,0.55)] backdrop-blur md:p-8">
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

        {error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        {!result && (
          <div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 md:p-8">
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
            <div className="flex flex-wrap items-center gap-3">
              <Badge label={`신뢰도 ${result.confidence}%`} />
              <Badge label={`입력 형식: ${result.sourceType}`} />
              <Badge label={`목표 출처: ${goalSourceLabel(result.goalSource)}`} />
              {result.reviewRequired && <Badge label="수치 확인 필요" warning />}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
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

            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5">
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
              <button
                type="button"
                onClick={rerunWithConfirmedMetrics}
                disabled={reviewLoading}
                className="mt-3 rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-200 disabled:opacity-60"
              >
                {reviewLoading ? "재상담 중..." : "확정값으로 재상담"}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metricLabels).map(([key, label]) => (
                <MetricCard key={key} label={label} value={result.metrics?.[key] || "-"} />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
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

            {result.warnings?.length > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
                <h3 className="font-semibold text-amber-100">검토 알림</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-amber-50">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 shadow-[0_16px_50px_-30px_rgba(6,182,212,0.8)]">
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
                    <div key={section.key} className={`rounded-2xl border p-5 ${visual.cardClass}`}>
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
                      <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-3">
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

            <details className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6">
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

  const items = lines.flatMap((line) => splitReadableSentences(line)).filter((line) => line.length >= 12);
  const uniqueItems: string[] = [];
  for (const item of items) {
    if (!uniqueItems.includes(item)) uniqueItems.push(item);
    if (uniqueItems.length >= 4) break;
  }

  if (uniqueItems.length === 0) {
    return sectionFallbackDigest(sectionKey, result);
  }

  return {
    summary: uniqueItems[0],
    items: uniqueItems,
  };
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
    const matched = sectionRules.find((rule) => rule.keywords.some((k) => line.includes(k)));
    if (matched && line.length <= 80) {
      currentKey = matched.key;
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

  if (meaningfulKoreanLines.length >= 2) {
    return raw;
  }

  return buildFallbackConsultation(result);
}

function buildFallbackConsultation(result: InbodyResponse) {
  const weight = result.metrics.weight_kg || "-";
  const muscle = result.metrics.skeletal_muscle_kg || "-";
  const bodyFat = result.metrics.body_fat_percent || "-";
  const visceralFat = result.metrics.visceral_fat_level || "-";
  const calories = result.dailyNutrition.calories_kcal || "-";
  const protein = result.dailyNutrition.protein_g || "-";
  const carb = result.dailyNutrition.carb_g || "-";
  const fat = result.dailyNutrition.fat_g || "-";
  const firstWeek = result.weeklyCheckpoints?.[0];

  return [
    "현재 상태",
    `현재 체중은 ${weight}kg, 골격근량은 ${muscle}kg, 체지방률은 ${bodyFat}%, 내장지방 레벨은 ${visceralFat}입니다.`,
    "체중 숫자 하나보다 체지방과 근육량의 균형을 함께 보는 것이 더 중요합니다.",
    "",
    "목표 설정",
    "확정한 수치를 기준으로 보면 극단적인 감량보다 체성분을 천천히 개선하는 방향이 이해하기 쉽습니다.",
    "1~4주 단위의 짧은 목표와 12주 단위의 중간 목표를 함께 관리하면 부담이 줄어듭니다.",
    "",
    "식단/영양",
    `하루 식단은 약 ${calories}kcal 기준으로 보고, 탄수화물 ${carb}g, 단백질 ${protein}g, 지방 ${fat}g 수준으로 나눠 이해하면 됩니다.`,
    "초보자는 끼니마다 단백질을 일정하게 나눠 먹는 것부터 시작하는 것이 가장 쉽습니다.",
    "",
    "운동 계획",
    "주 2~4회 정도의 꾸준한 근력운동과 쉬운 유산소부터 시작하면 충분합니다.",
    "처음에는 강도보다 꾸준함, 자세, 회복을 우선하는 편이 좋습니다.",
    "",
    "체크포인트",
    firstWeek?.focus
      ? `첫 체크포인트는 '${firstWeek.focus}'입니다. 이 항목을 이번 주 우선순위로 두고 기록을 남기세요.`
      : "첫 1~2주는 몸이 적응하는 기간으로 보고 체중, 식사, 컨디션을 함께 기록하세요.",
    "주 1회 같은 시간에 체중과 컨디션을 기록하면 변화 추세를 읽기 쉽습니다.",
    "",
    "주의사항",
    "무리한 감량과 과도한 운동보다 지속 가능한 루틴을 만드는 것이 더 중요합니다.",
    "피로감이나 통증이 크면 강도를 낮추고 수면과 식사를 먼저 점검하세요.",
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

function buildMetricInsightCards(metrics: Record<string, string>) {
  return [
    metricInsight("BMI", metrics.bmi, interpretBmi(toNumber(metrics.bmi))),
    metricInsight("체지방률", metrics.body_fat_percent ? `${metrics.body_fat_percent}%` : "-", interpretBodyFat(toNumber(metrics.body_fat_percent))),
    metricInsight("내장지방 레벨", metrics.visceral_fat_level, interpretVisceralFat(toNumber(metrics.visceral_fat_level))),
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

function safeGetUser(): { email?: string; nickname?: string } | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

const toNumber = (value?: string) => {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const round1 = (value: number) => Math.round(value * 10) / 10;
