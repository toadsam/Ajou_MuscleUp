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

const API_BASE = import.meta.env.VITE_API_BASE;

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

export default function InbodyConsult() {
  const [file, setFile] = useState<File | null>(null);
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [goalIntensity, setGoalIntensity] = useState<(typeof goalIntensityOptions)[number]["value"]>("standard");
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

  const consultationSections = useMemo(() => {
    return result ? buildConsultationSections(result.consultation || "") : [];
  }, [result]);

  const summaryLines = useMemo(() => buildKeySummaryLines(result?.consultation || "", consultationSections, 3), [result, consultationSections]);

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
              {loading ? "AI 분석 중..." : "분석 시작"}
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metricLabels).map(([key, label]) => (
                <MetricCard key={key} label={label} value={result.metrics?.[key] || "-"} />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="현재 vs 목표 (고정 축)">
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
                  return (
                    <div key={section.key} className={`rounded-xl border p-4 ${visual.cardClass}`}>
                      <p className={`text-sm font-semibold ${visual.titleClass}`}>[{visual.tag}] {section.title}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-100">{section.content}</pre>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6">
              <h3 className="text-lg font-semibold text-slate-200">원문 전체</h3>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.consultation}</pre>
            </div>
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
      return { tag: "현재", cardClass: "border-sky-500/40 bg-sky-500/10", titleClass: "text-sky-200" };
    case "goal":
      return { tag: "목표", cardClass: "border-cyan-500/40 bg-cyan-500/10", titleClass: "text-cyan-200" };
    case "nutrition":
      return { tag: "식단", cardClass: "border-emerald-500/40 bg-emerald-500/10", titleClass: "text-emerald-200" };
    case "exercise":
      return { tag: "운동", cardClass: "border-rose-500/40 bg-rose-500/10", titleClass: "text-rose-200" };
    case "checkpoint":
      return { tag: "체크", cardClass: "border-amber-500/40 bg-amber-500/10", titleClass: "text-amber-200" };
    case "caution":
      return { tag: "주의", cardClass: "border-orange-500/40 bg-orange-500/10", titleClass: "text-orange-200" };
    default:
      return { tag: "상담", cardClass: "border-slate-600 bg-slate-950", titleClass: "text-slate-200" };
  }
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
      .find((line) => line.length >= 8);
    if (first) candidates.push(first);
  }

  if (candidates.length === 0) {
    const fallback = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter((line) => line.length >= 8);
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
