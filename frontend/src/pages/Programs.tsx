
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logEvent } from "../utils/analytics";
import Barbell from "../components/gym/Barbell";
import { friendlyError, httpError } from "../lib/httpError";
import { useCurrentGym } from "../lib/currentGym";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 로그인한 사용자면 신청 폼의 이름·이메일을 미리 채운다(저장된 로그인 정보 기준, 직접 고칠 수 있음).
const readLoggedInUser = (): { name: string; email: string } => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return { name: "", email: "" };
    const user = JSON.parse(raw) as { nickname?: unknown; name?: unknown; email?: unknown };
    const name = typeof user.name === "string" ? user.name : typeof user.nickname === "string" ? user.nickname : "";
    const email = typeof user.email === "string" ? user.email : "";
    return { name, email };
  } catch {
    return { name: "", email: "" };
  }
};

// 신청 폼 입력칸: 철판 안쪽의 어두운 칸 + 포커스 시 노란 외곽선
const FIELD =
  "dg-well w-full px-4 py-3 text-white placeholder:text-steel-500 transition-colors focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";

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

type InbodyPresetState = {
  inbodyPreset?: {
    goalHint?: string;
    recommendedTrack?: TrackId;
  };
};

const programs: ProgramDefinition[] = [
  {
    id: "starter",
    title: "입문반",
    shortLabel: "Starter",
    eyebrow: "습관 만들기",
    accent: "bg-plate-yellow",
    ring: "border-t-plate-yellow",
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
    accent: "bg-plate-green",
    ring: "border-t-plate-green",
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
    accent: "bg-plate-blue",
    ring: "border-t-plate-blue",
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
    accent: "bg-plate-white",
    ring: "border-t-plate-white",
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
  const location = useLocation();
  const surveyRef = useRef<HTMLElement | null>(null);
  const applyRef = useRef<HTMLElement | null>(null);
  // 헤더에서 고른 모임이 있으면 그 모임 앞으로 신청한다(없으면 앱 전체)
  const [currentGymSlug] = useCurrentGym();

  const [answers, setAnswers] = useState<SurveyAnswers>(initialAnswers);
  const [selectedTrack, setSelectedTrack] = useState<TrackId>("starter");
  const [form, setForm] = useState<ApplicationForm>(() => {
    const user = readLoggedInUser();
    return { ...initialForm, name: initialForm.name || user.name, email: initialForm.email || user.email };
  });
  const [submitted, setSubmitted] = useState(false);
  // 제출 중에는 버튼을 막아 두 번 눌러 신청이 두 건 들어가지 않게 한다.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logEvent("programs", "page_view");
  }, []);

  useEffect(() => {
    const state = location.state as InbodyPresetState | null;
    const preset = state?.inbodyPreset;
    if (!preset) return;

    if (preset.recommendedTrack) {
      setSelectedTrack(preset.recommendedTrack);
    }
    if (preset.goalHint) {
      setForm((prev) => ({ ...prev, personalGoal: prev.personalGoal || preset.goalHint || "" }));
    }
  }, [location.state]);

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
    if (submitting) return;
    setError(null);
    setSubmitted(false);
    setSubmitting(true);

    try {
      const recommendedTrack = recommendation ? trackLookup[recommendation.trackId] : null;
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        goal: makeGoalPayload(recommendedTrack),
        track: selectedProgram.title,
        commitment: makeCommitmentPayload(),
      };

      const response = await fetch(`${API_BASE}/api/programs/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, gymSlug: currentGymSlug ?? undefined }),
      });

      if (!response.ok) {
        throw await httpError(response, "신청을 접수하지 못했어요.");
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
      setError(friendlyError(submitError, "신청을 접수하지 못했어요. 잠시 뒤에 다시 시도해 주세요."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden px-4 pb-32 pt-24 text-white sm:px-6 lg:px-10">
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 sm:gap-10">
        <header className="dg-steel grid gap-6 p-5 sm:gap-8 sm:p-8 xl:grid-cols-[1.15fr_0.85fr] xl:p-10">
          <div className="space-y-5">
            <p className="font-num text-base font-bold text-orange-300">Programs</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-2xl text-white sm:text-4xl">
                설문으로 현재 운동 상태를 파악하고, 나에게 맞는 반을 바로 신청하세요.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-steel-300 sm:text-base sm:leading-7 lg:text-lg">
                기존 식단방/잡담방을 4개 반 구조로 개편했습니다. 입문, 감량, 성장, 유지 중 어떤 흐름이 맞는지
                간단한 설문으로 추천하고, 결과를 바탕으로 바로 반 신청까지 이어집니다.
              </p>
            </div>
            <div className="hidden flex-wrap gap-3 text-sm font-semibold sm:flex">
              <button type="button" onClick={() => jumpTo(surveyRef)} className="dg-btn dg-btn-primary px-5">
                설문으로 추천받기
              </button>
              <button type="button" onClick={() => jumpTo(applyRef)} className="dg-btn dg-btn-steel px-5">
                직접 반 선택하기
              </button>
            </div>
          </div>

          <div className="dg-whiteboard p-4 sm:p-6">
            <p className="font-pen text-3xl leading-none">Page Flow</p>
            <div className="mt-4 grid gap-2 sm:hidden">
              {["반 소개", "6문항 설문", "추천 확인", "신청 완료"].map((item, index) => (
                <div key={item} className="rounded border-2 border-dashed border-board-frame px-3 py-2 text-sm font-semibold">
                  <span className="font-num mr-2 font-black text-board-red">0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 hidden space-y-3 sm:block">
              {[
                ["1. 반 소개 확인", "4개 반의 분위기와 추천 대상을 먼저 확인합니다."],
                ["2. 6문항 설문 진행", "운동 경험, 빈도, 목표, 스타일을 단계별로 답합니다."],
                ["3. 추천 반 확인", "추천 이유와 현재 단계 설명을 함께 제공합니다."],
                ["4. 반 신청 완료", "추천 반 또는 원하는 반을 직접 선택해 신청합니다."],
              ].map(([title, text], index) => (
                <div key={title} className="flex gap-4 rounded border-2 border-dashed border-board-frame p-3">
                  <div className="font-num flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-board-ink text-base font-black text-board-red">
                    0{index + 1}
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="sm:hidden">
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
            {programs.map((program) => {
              const isSelected = selectedTrack === program.id;
              const isRecommended = recommendation?.trackId === program.id;
              return (
                <article
                  key={`mobile-${program.id}`}
                  className={`min-w-[86%] snap-start rounded-xl border-[3px] border-t-[8px] p-4 shadow-md transition-colors ${program.ring} ${
                    isSelected ? "border-x-plate-yellow border-b-plate-yellow bg-steel-700" : "border-x-black border-b-black bg-steel-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? "text-orange-300" : "text-steel-400"}`}>
                        {program.eyebrow}
                      </p>
                      <h2 className="font-display mt-1 text-xl">{program.title}</h2>
                    </div>
                    <span className="dg-chip bg-steel-900 text-xs text-chalk">{program.shortLabel}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-steel-200">{program.description}</p>
                  {isRecommended && <p className="dg-pop dg-chip mt-2 bg-plate-yellow text-xs text-black">설문 추천 반</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrack(program.id);
                      jumpTo(applyRef);
                    }}
                    className={`dg-btn mt-4 w-full min-h-[42px] text-sm ${isSelected ? "dg-btn-primary" : "dg-btn-steel"}`}
                  >
                    이 반 선택
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="hidden gap-5 sm:grid lg:grid-cols-2 xl:grid-cols-4">
          {programs.map((program, idx) => {
            const isSelected = selectedTrack === program.id;
            const isRecommended = recommendation?.trackId === program.id;
            return (
              <article
                key={program.id}
                className={`dg-rise dg-lift relative flex flex-col rounded-xl border-[3px] border-t-[10px] p-6 shadow-md ${program.ring} ${
                  isSelected ? "border-x-plate-yellow border-b-plate-yellow bg-steel-700" : "border-x-black border-b-black bg-steel-800"
                }`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {isSelected && (
                  <span className="dg-pop absolute -right-2 -top-4 grid h-8 w-8 place-items-center rounded-full border-[3px] border-black bg-plate-yellow text-black shadow-sm" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${isSelected ? "text-orange-300" : "text-steel-400"}`}>
                      {program.eyebrow}
                    </p>
                    <h2 className="font-display mt-2 text-2xl">{program.title}</h2>
                  </div>
                  <span className="dg-chip bg-steel-900 text-sm text-chalk">
                    {program.shortLabel}
                  </span>
                </div>

                <p className={`mt-4 text-sm leading-6 ${isSelected ? "text-steel-100" : "text-steel-300"}`}>
                  {program.description}
                </p>

                <div className="dg-well mt-5 p-4">
                  <p className={`text-xs font-bold ${isSelected ? "text-orange-300" : "text-steel-400"}`}>
                    추천 대상
                  </p>
                  <p className="mt-2 text-sm leading-6">{program.target}</p>
                </div>

                <ul className="mt-5 space-y-2 text-sm leading-6">
                  {program.highlights.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className={`mt-1.5 h-3 w-1.5 flex-none rounded-sm border border-black ${program.accent}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <div>
                    {isRecommended && (
                      <p className="dg-pop dg-chip mb-1 bg-plate-yellow text-xs text-black">
                        설문 추천 반
                      </p>
                    )}
                    <p className={`text-xs ${isSelected ? "text-steel-200" : "text-steel-400"}`}>{program.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrack(program.id);
                      jumpTo(applyRef);
                    }}
                    className={`dg-btn min-h-[40px] flex-none px-4 text-sm ${isSelected ? "dg-btn-primary" : "dg-btn-steel"}`}
                  >
                    이 반 선택
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section ref={surveyRef} className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="dg-steel p-7 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-num text-base font-bold text-orange-300">Survey</p>
                <h3 className="font-display mt-1 text-3xl text-white">반 추천 설문</h3>
                <p className="mt-2 text-sm leading-6 text-steel-300">
                  총 6문항입니다. 답변을 완료하면 바로 추천 반과 이유를 보여줍니다.
                </p>
              </div>
              <div className="dg-well min-w-44 px-4 py-3 text-white">
                <p className="font-num text-sm font-bold text-orange-300">Progress</p>
                <p key={progress} className="dg-pop font-num mt-1 text-4xl font-black">{progress}%</p>
              </div>
            </div>

            {/* 답한 문항 수만큼 바벨에 원판이 끼워진다 */}
            <div className="dg-well mt-5 px-3 py-2">
              <Barbell loaded={answeredCount} slots={surveyQuestions.length} height={84} liftable />
            </div>

            <div className="mt-5 flex gap-3">
              {steps.map((step) => {
                const isComplete = surveyQuestions
                  .filter((question) => question.step === step)
                  .every((question) => answers[question.id]);
                return (
                  <div key={step} className="flex-1">
                    <div
                      className={`h-3 rounded-sm border-2 border-black transition-colors duration-300 ${isComplete ? "bg-plate-green" : "bg-steel-900"}`}
                    />
                    <p className={`font-num mt-2 text-sm font-bold ${isComplete ? "text-green-300" : "text-steel-400"}`}>Step {step}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 space-y-8">
              {steps.map((step) => (
                <div key={step} className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="font-num flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-black bg-orange-500 text-lg font-black text-black">
                      {step}
                    </div>
                    <div>
                      <p className="font-num text-sm font-bold text-steel-400">Step {step}</p>
                      <p className="text-base font-bold text-white">
                        {step === 1 && "운동 기반 파악"}
                        {step === 2 && "목표와 강도 파악"}
                        {step === 3 && "운영 스타일 파악"}
                      </p>
                    </div>
                  </div>

                  {surveyQuestions
                    .filter((question) => question.step === step)
                    .map((question) => (
                      <div key={question.id} className="dg-well p-5">
                        <p className="text-lg font-bold text-white">{question.prompt}</p>
                        <p className="mt-1 text-sm leading-6 text-steel-400">{question.helper}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {question.options.map((option) => {
                            const active = answers[question.id] === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => handleAnswer(question.id, option.value)}
                                className={`dg-chalk-burst rounded-md border-[3px] px-4 py-4 text-left transition-all duration-100 ${
                                  active
                                    ? "translate-y-[3px] border-plate-yellow bg-steel-700 text-white shadow-none"
                                    : "border-black bg-steel-800 text-steel-200 shadow hover:-translate-y-0.5 hover:shadow-md"
                                }`}
                              >
                                <p className="flex items-center gap-2 font-bold">
                                  <span
                                    aria-hidden
                                    className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-black ${
                                      active ? "dg-pop bg-plate-yellow text-black" : "bg-steel-900"
                                    }`}
                                  >
                                    {active && (
                                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                                      </svg>
                                    )}
                                  </span>
                                  {option.label}
                                </p>
                                <p className={`mt-1 text-sm leading-6 ${active ? "text-steel-200" : "text-steel-400"}`}>
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
            <div className="dg-steel p-7 text-white sm:p-8">
              <p className="font-num text-base font-bold text-orange-300">Result</p>
              <h3 className="font-display mt-1 text-3xl">추천 반 결과</h3>

              {recommendation ? (
                <>
                  <div key={recommendation.trackId} className="dg-pop dg-well mt-6 border-l-[8px] border-l-plate-yellow p-5">
                    <p className="text-sm font-bold text-orange-300">추천 반</p>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="font-display text-3xl text-white">{trackLookup[recommendation.trackId].title}</p>
                        <p className="mt-1 text-sm text-steel-300">{recommendation.readiness}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrack(recommendation.trackId);
                          jumpTo(applyRef);
                        }}
                        className="dg-btn dg-btn-primary min-h-[42px] px-4 text-sm"
                      >
                        추천 반으로 신청
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {recommendation.reasons.map((reason, idx) => (
                      <div
                        key={reason}
                        className="dg-rise flex gap-3 rounded border-2 border-black bg-steel-800 p-4 text-sm leading-6 text-steel-200"
                        style={{ animationDelay: `${idx * 70}ms` }}
                      >
                        <span className="font-num text-lg font-black leading-6 text-plate-yellow">{idx + 1}</span>
                        {reason}
                      </div>
                    ))}
                  </div>

                  <div className="dg-whiteboard mt-5 p-5">
                    <p className="font-pen text-2xl leading-none">코칭 포인트</p>
                    <p className="mt-2 text-sm font-semibold leading-6">{recommendation.coachingPoint}</p>
                  </div>
                </>
              ) : (
                <div className="dg-well mt-6 border-dashed p-6 text-sm leading-6 text-steel-300">
                  설문 6문항에 모두 답하면 추천 반과 이유를 바로 보여줍니다. 설문 전에도 아래 신청 영역에서 직접 반을
                  선택할 수 있습니다.
                </div>
              )}
            </div>

            <div className="dg-steel p-7 sm:p-8">
              <p className="font-num text-base font-bold text-steel-400">UI Text</p>
              <h3 className="font-display mt-1 text-2xl text-white">프로젝트에 바로 넣을 문구</h3>
              <div className="mt-5 space-y-5 text-sm leading-6 text-steel-300">
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
          <div className="dg-steel p-7 text-white sm:p-8">
            <p className="font-num text-base font-bold text-orange-300">Apply</p>
            <h3 className="font-display mt-1 text-3xl">반 신청</h3>
            <p className="mt-3 text-sm leading-6 text-steel-300">
              추천 반을 그대로 신청해도 되고, 운영 방향을 보고 원하는 반을 직접 선택해도 됩니다.
            </p>

            <div key={selectedTrack} className={`dg-pop dg-well mt-6 border-t-[8px] p-5 ${selectedProgram.ring}`}>
              <p className="text-sm font-bold text-orange-300">현재 선택한 반</p>
              <p className="font-display mt-2 text-3xl">{selectedProgram.title}</p>
              <p className="mt-3 text-sm leading-6 text-steel-300">{selectedProgram.description}</p>
              <div className="mt-5 space-y-2 text-sm text-steel-200">
                <p>추천 대상: {selectedProgram.target}</p>
                <p>운영 포인트: {selectedProgram.summary}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {programs.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  aria-pressed={selectedTrack === program.id}
                  onClick={() => setSelectedTrack(program.id)}
                  className={`rounded-md border-[3px] px-4 py-4 text-left transition-all duration-100 ${
                    selectedTrack === program.id
                      ? "translate-y-[3px] border-black bg-plate-yellow text-black shadow-none"
                      : "border-black bg-steel-800 text-white shadow hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <p className="flex items-center gap-2 font-bold">
                    <span aria-hidden className={`h-4 w-1.5 rounded-sm border border-black ${program.accent}`} />
                    {program.title}
                  </p>
                  <p className={`mt-1 text-sm leading-6 ${selectedTrack === program.id ? "text-black/75" : "text-steel-300"}`}>
                    {program.summary}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="dg-steel p-7 sm:p-8">
            <p className="font-num text-base font-bold text-orange-300">Application Form</p>
            <h3 className="font-display mt-1 text-3xl text-white">신청 정보를 입력하세요</h3>
            <p className="mt-3 text-sm leading-6 text-steel-300">
              설문 결과는 추천 근거로만 사용됩니다. 최종 신청 반은 아래에서 직접 선택한 값으로 접수됩니다.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-steel-200">
                이름
                <input
                  name="name"
                  required
                  value={form.name}
                  onChange={handleFormChange}
                  className={`mt-2 ${FIELD}`}
                  placeholder="홍길동"
                />
              </label>

              <label className="block text-sm font-semibold text-steel-200">
                이메일
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleFormChange}
                  className={`mt-2 ${FIELD}`}
                  placeholder="you@example.com"
                />
              </label>

              <label className="block text-sm font-semibold text-steel-200">
                한 줄 목표
                <textarea
                  name="personalGoal"
                  required
                  value={form.personalGoal}
                  onChange={handleFormChange}
                  rows={4}
                  className={`mt-2 ${FIELD}`}
                  placeholder="예: 3개월 동안 주 3회 운동 습관을 만들고 체지방을 줄이고 싶어요."
                />
              </label>

              <label className="block text-sm font-semibold text-steel-200">
                참여 다짐
                <input
                  name="commitment"
                  required
                  value={form.commitment}
                  onChange={handleFormChange}
                  className={`mt-2 ${FIELD}`}
                  placeholder="예: 주 3회 이상 참여하며 운동 기록을 남길게요."
                />
              </label>
            </div>

            <div className="dg-whiteboard mt-6 p-5">
              <p className="font-pen text-2xl leading-none">신청 요약</p>
              <div className="mt-3 space-y-2 text-sm leading-6">
                <p>
                  최종 신청 반: <span className="font-bold text-board-red">{selectedProgram.title}</span>
                </p>
                <p>
                  설문 추천 반:{" "}
                  <span className="font-bold text-board-blue">
                    {recommendation ? trackLookup[recommendation.trackId].title : "아직 없음"}
                  </span>
                </p>
                <p>
                  안내 문구:{" "}
                  <span className="font-semibold">
                    추천 반으로 바로 신청하거나, 원하는 반을 직접 골라 참여할 수 있습니다.
                  </span>
                </p>
              </div>
            </div>

            {error && <p className="dg-pop dg-well mt-4 border-l-4 border-l-plate-red p-3 text-sm font-semibold text-red-200">{error}</p>}
            {submitted && <p className="dg-pop mt-4 text-sm font-semibold text-green-300">신청이 접수되었습니다.</p>}

            <button type="submit" disabled={submitting} aria-busy={submitting} className="dg-btn dg-btn-primary mt-6 w-full min-h-[56px] text-base">
              {submitting ? "신청 보내는 중..." : `${selectedProgram.title} 신청하기`}
            </button>
          </form>
        </section>
      </div>

      <div className="programs-mobile-action-dock fixed inset-x-0 bottom-4 z-40 px-4 sm:hidden">
        <div className="mx-auto flex max-w-md gap-3 rounded-lg border-[3px] border-black bg-steel-800 p-2 shadow-xl">
          <button type="button" onClick={() => jumpTo(surveyRef)} className="dg-btn dg-btn-primary flex-1 text-sm">
            설문 이동
          </button>
          <button type="button" onClick={() => jumpTo(applyRef)} className="dg-btn dg-btn-steel flex-1 text-sm">
            신청 이동
          </button>
        </div>
      </div>
    </section>
  );
}


