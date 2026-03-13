
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { logEvent } from "../utils/analytics";

type TrackId = "starter" | "cut" | "growth" | "balance";
type QuestionId = "experience" | "frequency" | "confidence" | "goal" | "challenge" | "style";

type AnswerValue =
  | "none"
  | "short"
  | "steady"
  | "long"
  | "rare"
  | "light"
  | "active"
  | "intense"
  | "low"
  | "mid"
  | "high"
  | "habit"
  | "loss"
  | "gain"
  | "maintain"
  | "unclear"
  | "consistency"
  | "diet"
  | "system"
  | "easy"
  | "fatburn"
  | "strength"
  | "routine";

type SurveyAnswers = Record<QuestionId, AnswerValue | "">;

interface ProgramDefinition {
  id: TrackId;
  title: string;
  shortLabel: string;
  eyebrow: string;
  accent: string;
  ring: string;
  description: string;
  target: string;
  summary: string;
  highlights: string[];
}

interface QuestionOption {
  value: AnswerValue;
  label: string;
  hint: string;
}

interface SurveyQuestion {
  id: QuestionId;
  step: number;
  prompt: string;
  helper: string;
  options: QuestionOption[];
}

interface ApplicationForm {
  name: string;
  email: string;
  personalGoal: string;
  commitment: string;
}

interface Recommendation {
  trackId: TrackId;
  reasons: string[];
  readiness: string;
  coachingPoint: string;
}

const programs: ProgramDefinition[] = [
  {
    id: "starter",
    title: "입문반",
    shortLabel: "Starter",
    eyebrow: "습관 만들기",
    accent: "from-amber-300 via-orange-300 to-rose-300",
    ring: "shadow-[0_18px_60px_-30px_rgba(251,146,60,0.6)]",
    description: "운동이 낯설어도 괜찮습니다. 루틴을 처음 만들고, 몸을 안전하게 깨우는 단계입니다.",
    target: "운동이 처음이거나, 다시 시작하는 사람",
    summary: "무리 없는 시작, 자세 적응, 기본 루틴 정착에 집중합니다.",
    highlights: ["쉬운 난이도부터 시작", "운동 루틴과 체크 습관 형성", "기초 식단 가이드 제공"],
  },
  {
    id: "cut",
    title: "감량반",
    shortLabel: "Cut",
    eyebrow: "체형 관리",
    accent: "from-emerald-200 via-teal-200 to-cyan-200",
    ring: "shadow-[0_18px_60px_-30px_rgba(45,212,191,0.55)]",
    description: "체중 감량과 체형 정리를 목표로, 유산소와 기초 근력을 균형 있게 설계합니다.",
    target: "살을 빼고 싶고 식단 관리도 함께 잡고 싶은 사람",
    summary: "감량 목표에 맞춘 루틴과 식단 공유 흐름이 중심입니다.",
    highlights: ["감량 목표 중심 루틴", "식단 기록과 피드백 연계", "무리 없는 지속 가능 플랜"],
  },
  {
    id: "growth",
    title: "성장반",
    shortLabel: "Growth",
    eyebrow: "근력 향상",
    accent: "from-sky-200 via-indigo-200 to-fuchsia-200",
    ring: "shadow-[0_18px_60px_-30px_rgba(96,165,250,0.55)]",
    description: "근력 향상과 근육 성장을 목표로, 웨이트 중심 루틴과 기록 관리에 집중합니다.",
    target: "몸을 키우고 싶고 운동 강도를 올릴 준비가 된 사람",
    summary: "점진적 과부하, 운동 기록, 식단 의지가 잘 맞는 반입니다.",
    highlights: ["웨이트 중심 루틴", "운동 기록과 성장 추적", "근성장에 맞는 식단 의식"],
  },
  {
    id: "balance",
    title: "유지반",
    shortLabel: "Balance",
    eyebrow: "꾸준한 관리",
    accent: "from-stone-200 via-zinc-100 to-slate-200",
    ring: "shadow-[0_18px_60px_-30px_rgba(148,163,184,0.45)]",
    description: "큰 벌크업이나 감량보다, 건강한 생활 패턴을 오래 유지하는 데 초점을 둡니다.",
    target: "지금 몸 상태를 안정적으로 유지하고 싶은 사람",
    summary: "부담 없이 오래 가는 루틴, 컨디션 관리, 밸런스 있는 식단이 핵심입니다.",
    highlights: ["지속 가능한 루틴 설계", "컨디션과 생활 균형 중시", "유지형 식단 습관 정착"],
  },
];

const surveyQuestions: SurveyQuestion[] = [
  {
    id: "experience",
    step: 1,
    prompt: "운동 경험은 어느 정도인가요?",
    helper: "현재 수준을 파악해 반 난이도를 맞춥니다.",
    options: [
      { value: "none", label: "거의 처음이에요", hint: "운동 루틴이 아직 익숙하지 않아요." },
      { value: "short", label: "3개월 미만", hint: "시작은 했지만 아직 적응 중이에요." },
      { value: "steady", label: "3개월~1년", hint: "기본 루틴은 어느 정도 있어요." },
      { value: "long", label: "1년 이상", hint: "운동을 꾸준히 해본 편이에요." },
    ],
  },
  {
    id: "frequency",
    step: 1,
    prompt: "현재 운동 빈도는 어느 정도인가요?",
    helper: "실제 생활 리듬에 맞는 반을 추천합니다.",
    options: [
      { value: "rare", label: "거의 안 해요", hint: "지금부터 습관을 만들어야 해요." },
      { value: "light", label: "주 1~2회", hint: "부담 없는 빈도로 운동 중이에요." },
      { value: "active", label: "주 3~4회", hint: "운동이 생활에 꽤 들어와 있어요." },
      { value: "intense", label: "주 5회 이상", hint: "강도 있는 루틴도 소화 가능해요." },
    ],
  },
  {
    id: "confidence",
    step: 2,
    prompt: "스스로 느끼는 체력과 운동 적응도는 어떤가요?",
    helper: "강도 조절과 시작 난이도를 위한 질문입니다.",
    options: [
      { value: "low", label: "체력이 많이 부족해요", hint: "쉬운 난이도로 시작하는 편이 좋아요." },
      { value: "mid", label: "보통이에요", hint: "무리 없는 루틴은 따라갈 수 있어요." },
      { value: "high", label: "강도 높은 운동도 가능해요", hint: "성장형 루틴도 고려할 수 있어요." },
    ],
  },
  {
    id: "goal",
    step: 2,
    prompt: "지금 가장 원하는 목표는 무엇인가요?",
    helper: "반 배정에서 가장 큰 비중을 차지합니다.",
    options: [
      { value: "habit", label: "운동 습관 만들기", hint: "우선 시작하고 꾸준함을 만들고 싶어요." },
      { value: "loss", label: "체중 감량 / 체형 관리", hint: "감량과 라인 정리가 가장 중요해요." },
      { value: "gain", label: "근력 증가 / 근육 성장", hint: "더 강해지고 몸을 키우고 싶어요." },
      { value: "maintain", label: "현재 상태 유지 / 건강 관리", hint: "오래 유지 가능한 루틴이 필요해요." },
    ],
  },
  {
    id: "challenge",
    step: 3,
    prompt: "운동할 때 가장 어려운 점은 무엇인가요?",
    helper: "추천 반에서 어떤 도움을 강조할지 정합니다.",
    options: [
      { value: "unclear", label: "무엇부터 해야 할지 모르겠어요", hint: "기초 가이드가 가장 먼저 필요해요." },
      { value: "consistency", label: "꾸준히 하기가 어려워요", hint: "생활 리듬에 맞는 설계가 중요해요." },
      { value: "diet", label: "식단 관리가 어려워요", hint: "감량형 커뮤니티와 잘 맞아요." },
      { value: "system", label: "더 체계적으로 성장하고 싶어요", hint: "기록과 훈련 체계가 중요해요." },
    ],
  },
  {
    id: "style",
    step: 3,
    prompt: "어떤 운동 스타일이 가장 마음에 드나요?",
    helper: "반 분위기와 운영 방식을 맞추기 위한 질문입니다.",
    options: [
      { value: "easy", label: "아주 쉬운 난이도부터", hint: "부담 없이 시작하는 흐름을 원해요." },
      { value: "fatburn", label: "감량 중심 루틴", hint: "체지방 관리가 우선이에요." },
      { value: "strength", label: "근력 / 웨이트 중심", hint: "성장과 기록 향상이 중요해요." },
      { value: "routine", label: "꾸준히 유지 가능한 루틴", hint: "무리 없이 오래 가는 게 좋아요." },
    ],
  },
];

const initialAnswers: SurveyAnswers = {
  experience: "",
  frequency: "",
  confidence: "",
  goal: "",
  challenge: "",
  style: "",
};

const initialForm: ApplicationForm = {
  name: "",
  email: "",
  personalGoal: "",
  commitment: "주 3회 이상 참여하며 기록을 남길게요.",
};

const trackLookup = programs.reduce<Record<TrackId, ProgramDefinition>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {} as Record<TrackId, ProgramDefinition>);

function buildRecommendation(answers: SurveyAnswers): Recommendation | null {
  if (Object.values(answers).some((value) => value === "")) {
    return null;
  }

  const score: Record<TrackId, number> = {
    starter: 0,
    cut: 0,
    growth: 0,
    balance: 0,
  };

  const reasons: string[] = [];

  switch (answers.experience) {
    case "none":
      score.starter += 4;
      reasons.push("운동 경험이 거의 없어 가장 낮은 진입 난이도가 필요합니다.");
      break;
    case "short":
      score.starter += 2;
      score.cut += 1;
      reasons.push("운동을 시작한 지 오래되지 않아 기초 적응이 중요합니다.");
      break;
    case "steady":
      score.cut += 1;
      score.growth += 2;
      score.balance += 1;
      break;
    case "long":
      score.growth += 2;
      score.balance += 2;
      reasons.push("꾸준한 운동 경험이 있어 목표 중심 반으로 연결하기 좋습니다.");
      break;
  }

  switch (answers.frequency) {
    case "rare":
      score.starter += 3;
      reasons.push("현재 빈도가 낮아 루틴 정착형 구성이 우선입니다.");
      break;
    case "light":
      score.starter += 1;
      score.cut += 1;
      score.balance += 1;
      break;
    case "active":
      score.cut += 1;
      score.growth += 2;
      score.balance += 1;
      break;
    case "intense":
      score.growth += 3;
      score.balance += 1;
      reasons.push("운동 빈도가 높아 강도 있는 성장형 루틴도 소화 가능합니다.");
      break;
  }

  switch (answers.confidence) {
    case "low":
      score.starter += 3;
      score.cut += 1;
      reasons.push("체력 자신감이 낮아 안전한 적응 구간이 필요합니다.");
      break;
    case "mid":
      score.cut += 1;
      score.balance += 1;
      break;
    case "high":
      score.growth += 3;
      score.balance += 1;
      reasons.push("운동 강도를 충분히 올릴 수 있는 상태로 보입니다.");
      break;
  }

  switch (answers.goal) {
    case "habit":
      score.starter += 4;
      reasons.push("현재 최우선 목표가 습관 형성이므로 입문반 성격과 가장 잘 맞습니다.");
      break;
    case "loss":
      score.cut += 5;
      reasons.push("감량과 체형 관리 목표가 명확해 감량반 우선 추천이 적절합니다.");
      break;
    case "gain":
      score.growth += 5;
      reasons.push("근력 증가와 근육 성장이 핵심 목표라 성장반 적합도가 높습니다.");
      break;
    case "maintain":
      score.balance += 5;
      reasons.push("현재 상태 유지와 건강 관리 목표가 유지반과 직접 연결됩니다.");
      break;
  }

  switch (answers.challenge) {
    case "unclear":
      score.starter += 2;
      break;
    case "consistency":
      score.starter += 1;
      score.balance += 1;
      break;
    case "diet":
      score.cut += 2;
      reasons.push("식단 관리 부담이 크다면 감량반의 식단 공유 흐름이 도움이 됩니다.");
      break;
    case "system":
      score.growth += 2;
      reasons.push("체계적인 성장 니즈가 있어 성장반의 기록형 운영과 잘 맞습니다.");
      break;
  }

  switch (answers.style) {
    case "easy":
      score.starter += 2;
      break;
    case "fatburn":
      score.cut += 2;
      break;
    case "strength":
      score.growth += 2;
      break;
    case "routine":
      score.balance += 2;
      break;
  }

  if (answers.goal === "gain" && (answers.experience === "none" || answers.confidence === "low")) {
    score.starter += 2;
    reasons.push("근성장 목표가 있어도 기초 적응이 부족하면 먼저 입문 흐름이 더 안전합니다.");
  }

  const orderedTracks = (Object.entries(score) as Array<[TrackId, number]>).sort((a, b) => b[1] - a[1]);
  const trackId = orderedTracks[0][0];

  const readinessMap: Record<TrackId, string> = {
    starter: "기초 적응 단계",
    cut: "감량 집중 단계",
    growth: "성장 집중 단계",
    balance: "유지 최적화 단계",
  };

  const coachingMap: Record<TrackId, string> = {
    starter: "처음 2주 동안은 강도보다 출석과 루틴 유지가 더 중요합니다.",
    cut: "식단 기록과 운동 빈도를 같이 잡을수록 감량 효율이 좋아집니다.",
    growth: "운동 기록을 남기고 강도를 조금씩 올리는 방식이 핵심입니다.",
    balance: "무리한 변화보다 생활 패턴과 회복 리듬을 일정하게 유지하는 편이 좋습니다.",
  };

  return {
    trackId,
    reasons: Array.from(new Set(reasons)).slice(0, 3),
    readiness: readinessMap[trackId],
    coachingPoint: coachingMap[trackId],
  };
}

export default function Programs() {
  const navigate = useNavigate();
  const surveyRef = useRef<HTMLElement | null>(null);
  const applyRef = useRef<HTMLElement | null>(null);

  const [answers, setAnswers] = useState<SurveyAnswers>(initialAnswers);
  const [selectedTrack, setSelectedTrack] = useState<TrackId>("starter");
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logEvent("programs", "page_view");
  }, []);

  const recommendation = useMemo(() => buildRecommendation(answers), [answers]);

  useEffect(() => {
    if (recommendation) {
      setSelectedTrack(recommendation.trackId);
    }
  }, [recommendation]);

  const steps = [1, 2, 3] as const;
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const progress = Math.round((answeredCount / surveyQuestions.length) * 100);
  const selectedProgram = trackLookup[selectedTrack];

  const handleAnswer = (questionId: QuestionId, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const jumpTo = (ref: RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const makeGoalPayload = (recommendedTrack: ProgramDefinition | null) => {
    const reasonText = recommendation?.reasons?.length
      ? `추천 이유: ${recommendation.reasons.join(" / ")}`
      : "추천 이유: 설문 없이 직접 반을 선택했습니다.";

    return [
      form.personalGoal.trim(),
      `선택 반: ${selectedProgram.title}`,
      recommendedTrack ? `추천 반: ${recommendedTrack.title}` : "추천 반: 없음",
      reasonText,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 500);
  };

  const makeCommitmentPayload = () => {
    const readiness = recommendation ? `현재 단계: ${recommendation.readiness}` : "현재 단계: 직접 선택";
    return [`참여 다짐: ${form.commitment.trim()}`, readiness].join(" | ").slice(0, 200);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitted(false);

    try {
      const recommendedTrack = recommendation ? trackLookup[recommendation.trackId] : null;
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        goal: makeGoalPayload(recommendedTrack),
        track: selectedProgram.title,
        commitment: makeCommitmentPayload(),
      };

      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/programs/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || `HTTP ${response.status}`);
      }

      setSubmitted(true);
      navigate("/programs/apply/success", {
        state: {
          form: {
            ...payload,
            personalGoal: form.personalGoal.trim(),
            recommendedTrack: recommendedTrack?.title ?? null,
            recommendationReasons: recommendation?.reasons ?? [],
            readiness: recommendation?.readiness ?? null,
            coachingPoint: recommendation?.coachingPoint ?? null,
          },
        },
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "신청 중 오류가 발생했습니다.";
      setError(message || "신청 중 오류가 발생했습니다.");
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] px-6 pb-24 pt-28 text-white lg:px-10">
      <div className="absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.2),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.65),_rgba(244,239,231,0))]" />
      <div className="absolute -left-20 top-40 h-72 w-72 rounded-full bg-orange-200/60 blur-3xl" />
      <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-cyan-200/50 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-10">
        <header className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-40px_rgba(120,53,15,0.45)] backdrop-blur xl:grid-cols-[1.15fr_0.85fr] xl:p-10">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">Programs</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                설문으로 현재 운동 상태를 파악하고, 나에게 맞는 반을 바로 신청하세요.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
                기존 식단방/잡담방을 4개 반 구조로 개편했습니다. 입문, 감량, 성장, 유지 중 어떤 흐름이 맞는지
                간단한 설문으로 추천하고, 결과를 바탕으로 바로 반 신청까지 이어집니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <button
                type="button"
                onClick={() => jumpTo(surveyRef)}
                className="rounded-full bg-slate-900/80 px-5 py-3 text-white transition hover:-translate-y-0.5"
              >
                설문으로 추천받기
              </button>
              <button
                type="button"
                onClick={() => jumpTo(applyRef)}
                className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white transition hover:border-white hover:bg-white/15"
              >
                직접 반 선택하기
              </button>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-slate-900/80 p-6 text-stone-100 shadow-[0_24px_80px_-45px_rgba(28,25,23,0.9)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">Page Flow</p>
            <div className="mt-5 space-y-4">
              {[
                ["1. 반 소개 확인", "4개 반의 분위기와 추천 대상을 먼저 확인합니다."],
                ["2. 6문항 설문 진행", "운동 경험, 빈도, 목표, 스타일을 단계별로 답합니다."],
                ["3. 추천 반 확인", "추천 이유와 현재 단계 설명을 함께 제공합니다."],
                ["4. 반 신청 완료", "추천 반 또는 원하는 반을 직접 선택해 신청합니다."],
              ].map(([title, text], index) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-300 text-sm font-black text-white">
                    0{index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-300">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {programs.map((program) => {
            const isSelected = selectedTrack === program.id;
            const isRecommended = recommendation?.trackId === program.id;
            return (
              <article
                key={program.id}
                className={`rounded-[1.8rem] border p-6 transition ${
                  isSelected
                    ? "border-white/30 bg-slate-900/80 text-white"
                    : "border-white/70 bg-white/5 text-white"
                } ${isSelected ? program.ring : "shadow-[0_20px_60px_-40px_rgba(120,53,15,0.25)]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${isSelected ? "text-orange-200" : "text-gray-400"}`}>
                      {program.eyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{program.title}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isSelected ? "bg-white/10 text-white" : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {program.shortLabel}
                  </span>
                </div>

                <p className={`mt-4 text-sm leading-6 ${isSelected ? "text-gray-200" : "text-gray-300"}`}>
                  {program.description}
                </p>

                <div className="mt-5 rounded-2xl border border-current/10 bg-black/5 p-4">
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${isSelected ? "text-orange-200" : "text-gray-400"}`}>
                    추천 대상
                  </p>
                  <p className="mt-2 text-sm leading-6">{program.target}</p>
                </div>

                <ul className="mt-5 space-y-2 text-sm leading-6">
                  {program.highlights.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className={`mt-2 h-2 w-2 rounded-full bg-gradient-to-r ${program.accent}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div>
                    {isRecommended && (
                      <p className={`text-sm font-semibold ${isSelected ? "text-orange-200" : "text-orange-700"}`}>
                        설문 추천 반
                      </p>
                    )}
                    <p className={`text-xs ${isSelected ? "text-gray-300" : "text-gray-400"}`}>{program.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrack(program.id);
                      jumpTo(applyRef);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-white/15 text-white hover:bg-white/25"
                        : "bg-slate-900/80 text-white hover:-translate-y-0.5"
                    }`}
                  >
                    이 반 선택
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section ref={surveyRef} className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-[0_24px_80px_-45px_rgba(68,64,60,0.35)] backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">Survey</p>
                <h3 className="mt-2 text-3xl font-black text-white">반 추천 설문</h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">
                  총 6문항입니다. 답변을 완료하면 바로 추천 반과 이유를 보여줍니다.
                </p>
              </div>
              <div className="min-w-44 rounded-2xl bg-slate-900/80 px-4 py-3 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-orange-300">Progress</p>
                <p className="mt-1 text-2xl font-black">{progress}%</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {steps.map((step) => {
                const isComplete = surveyQuestions
                  .filter((question) => question.step === step)
                  .every((question) => answers[question.id]);
                return (
                  <div key={step} className="flex-1">
                    <div className={`h-2 rounded-full ${isComplete ? "bg-slate-900/80" : "bg-white/15"}`} />
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Step {step}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 space-y-8">
              {steps.map((step) => (
                <div key={step} className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-sm font-black text-orange-700">
                      {step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Step {step}</p>
                      <p className="text-base font-semibold text-white">
                        {step === 1 && "운동 기반 파악"}
                        {step === 2 && "목표와 강도 파악"}
                        {step === 3 && "운영 스타일 파악"}
                      </p>
                    </div>
                  </div>

                  {surveyQuestions
                    .filter((question) => question.step === step)
                    .map((question) => (
                      <div key={question.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <p className="text-lg font-bold text-white">{question.prompt}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-400">{question.helper}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {question.options.map((option) => {
                            const active = answers[question.id] === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleAnswer(question.id, option.value)}
                                className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                                  active
                                    ? "border-white/30 bg-slate-900/80 text-white"
                                    : "border-white/10 bg-white/5 text-gray-200 hover:border-white/30"
                                }`}
                              >
                                <p className="font-semibold">{option.label}</p>
                                <p className={`mt-1 text-sm leading-6 ${active ? "text-gray-200" : "text-gray-400"}`}>
                                  {option.hint}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-7 text-white shadow-[0_24px_80px_-45px_rgba(28,25,23,0.85)] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">Result</p>
              <h3 className="mt-2 text-3xl font-black">추천 반 결과</h3>

              {recommendation ? (
                <>
                  <div className="mt-6 rounded-[1.5rem] bg-white/6 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-200">추천 반</p>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-3xl font-black text-white">{trackLookup[recommendation.trackId].title}</p>
                        <p className="mt-1 text-sm text-gray-300">{recommendation.readiness}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrack(recommendation.trackId);
                          jumpTo(applyRef);
                        }}
                        className="rounded-full bg-orange-300 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-orange-200"
                      >
                        추천 반으로 신청
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {recommendation.reasons.map((reason) => (
                      <div key={reason} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-gray-200">
                        {reason}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-200">코칭 포인트</p>
                    <p className="mt-2 text-sm leading-6 text-gray-300">{recommendation.coachingPoint}</p>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-sm leading-6 text-gray-300">
                  설문 6문항에 모두 답하면 추천 반과 이유를 바로 보여줍니다. 설문 전에도 아래 신청 영역에서 직접 반을
                  선택할 수 있습니다.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-[0_24px_80px_-45px_rgba(68,64,60,0.35)] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gray-400">UI Text</p>
              <h3 className="mt-2 text-2xl font-black text-white">프로젝트에 바로 넣을 문구</h3>
              <div className="mt-5 space-y-5 text-sm leading-6 text-gray-300">
                <div>
                  <p className="font-semibold text-white">상단 소개 문구</p>
                  <p>설문으로 현재 운동 상태를 파악하고, 나에게 맞는 반을 추천받아 바로 신청해보세요.</p>
                </div>
                <div>
                  <p className="font-semibold text-white">설문 시작 버튼</p>
                  <p>설문으로 추천받기</p>
                </div>
                <div>
                  <p className="font-semibold text-white">결과 페이지 핵심 문구</p>
                  <p>
                    당신의 현재 상태를 기준으로 보면 {recommendation ? trackLookup[recommendation.trackId].title : "추천 반"} 흐름이
                    가장 잘 맞습니다.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-white">신청 영역 안내 문구</p>
                  <p>추천 반으로 바로 신청하거나, 원하는 반을 직접 골라 참여할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section ref={applyRef} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-7 text-white shadow-[0_24px_80px_-45px_rgba(28,25,23,0.85)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">Apply</p>
            <h3 className="mt-2 text-3xl font-black">반 신청</h3>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              추천 반을 그대로 신청해도 되고, 운영 방향을 보고 원하는 반을 직접 선택해도 됩니다.
            </p>

            <div className="mt-6 rounded-[1.5rem] bg-white/6 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-200">현재 선택한 반</p>
              <p className="mt-2 text-3xl font-black">{selectedProgram.title}</p>
              <p className="mt-3 text-sm leading-6 text-gray-300">{selectedProgram.description}</p>
              <div className="mt-5 space-y-2 text-sm text-gray-200">
                <p>추천 대상: {selectedProgram.target}</p>
                <p>운영 포인트: {selectedProgram.summary}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {programs.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => setSelectedTrack(program.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    selectedTrack === program.id
                      ? "border-orange-300 bg-orange-300 text-stone-950"
                      : "border-white/10 bg-white/5 text-white hover:border-white/25"
                  }`}
                >
                  <p className="font-semibold">{program.title}</p>
                  <p className={`mt-1 text-sm leading-6 ${selectedTrack === program.id ? "text-gray-200" : "text-gray-300"}`}>
                    {program.summary}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-[0_24px_80px_-45px_rgba(68,64,60,0.35)] backdrop-blur sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">Application Form</p>
            <h3 className="mt-2 text-3xl font-black text-white">신청 정보를 입력하세요</h3>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              설문 결과는 추천 근거로만 사용됩니다. 최종 신청 반은 아래에서 직접 선택한 값으로 접수됩니다.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-gray-200">
                이름
                <input
                  name="name"
                  required
                  value={form.name}
                  onChange={handleFormChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-white/40"
                  placeholder="홍길동"
                />
              </label>

              <label className="block text-sm font-semibold text-gray-200">
                이메일
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleFormChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-white/40"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block text-sm font-semibold text-gray-200">
                한 줄 목표
                <textarea
                  name="personalGoal"
                  required
                  value={form.personalGoal}
                  onChange={handleFormChange}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-white/40"
                  placeholder="예: 3개월 동안 주 3회 운동 습관을 만들고 체지방을 줄이고 싶어요."
                />
              </label>

              <label className="block text-sm font-semibold text-gray-200">
                참여 다짐
                <input
                  name="commitment"
                  required
                  value={form.commitment}
                  onChange={handleFormChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-white/40"
                  placeholder="예: 주 3회 이상 참여하며 운동 기록을 남길게요."
                />
              </label>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">신청 요약</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-gray-300">
                <p>
                  최종 신청 반: <span className="font-semibold text-white">{selectedProgram.title}</span>
                </p>
                <p>
                  설문 추천 반:{" "}
                  <span className="font-semibold text-white">
                    {recommendation ? trackLookup[recommendation.trackId].title : "아직 없음"}
                  </span>
                </p>
                <p>
                  안내 문구:{" "}
                  <span className="font-semibold text-white">
                    추천 반으로 바로 신청하거나, 원하는 반을 직접 골라 참여할 수 있습니다.
                  </span>
                </p>
              </div>
            </div>

            {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
            {submitted && <p className="mt-4 text-sm font-semibold text-emerald-700">신청이 접수되었습니다.</p>}

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-slate-900/80 px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              {selectedProgram.title} 신청하기
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}


