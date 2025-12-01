import { useState } from "react";

interface ApplicationForm {
  name: string;
  email: string;
  goal: string;
  track: "diet" | "fitness";
  commitment: string;
}

const tracks = [
  {
    id: "diet",
    title: "식단방",
    badge: "매칭 48시간",
    gradient: "from-emerald-400/40 via-teal-400/30 to-cyan-300/30",
    description: "개인 맞춤 식단 피드백과 인증 미션을 통해 건강한 식습관을 만드는 트랙.",
    highlights: ["주 3회 식단 피드백", "인증: 식단 사진/칼로리 기록", "영양사 템플릿 제공"],
  },
  {
    id: "fitness",
    title: "다이어트반",
    badge: "주간 리포트",
    gradient: "from-pink-500/30 via-purple-500/20 to-indigo-500/20",
    description: "체지방 감량을 위한 루틴 + 일일 인증. 버디와 함께 동기부여를 주고받습니다.",
    highlights: ["주 4회 운동 인증", "인증: 심박·캘린더 업로드", "주간 체크인 & 보상"],
  },
];

const certificationSteps = [
  { title: "1. 일일 인증", detail: "운동 혹은 식단 사진/로그를 업로드하면 자동으로 누적됩니다." },
  { title: "2. 주간 리포트", detail: "누적 데이터 기반으로 AI 리포트 + 코치 피드백을 받습니다." },
  { title: "3. 보상 & 리셋", detail: "목표 달성 시 뱃지/포인트 지급, 다음 주 목표 리셋." },
];

export default function Programs() {
  const [form, setForm] = useState<ApplicationForm>({
    name: "",
    email: "",
    goal: "",
    track: "diet",
    commitment: "주 4회 이상 참여",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value as ApplicationForm[keyof ApplicationForm] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3500);
  };

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-6 pb-24 pt-28 text-white lg:px-10">
      <div className="glow-orb absolute -left-24 top-8 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="glow-orb absolute right-0 top-20 h-96 w-80 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-200">Programs</p>
          <h1 className="text-3xl font-bold sm:text-4xl">식단방 · 다이어트반</h1>
          <p className="text-base text-gray-300">인증과 피드백으로 동기부여를 유지하세요. 원하는 트랙을 선택해 신청할 수 있습니다.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {tracks.map((track) => (
            <div key={track.id} className={`rounded-3xl border border-white/5 bg-gradient-to-br ${track.gradient} p-6 shadow-xl backdrop-blur`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Program</p>
                  <h2 className="mt-1 text-2xl font-bold">{track.title}</h2>
                </div>
                <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/90">{track.badge}</span>
              </div>
              <p className="mt-4 text-sm text-white/90">{track.description}</p>
              <div className="mt-5 space-y-3">
                {track.highlights.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-3 text-sm text-white/90">
                    <span className="h-2 w-2 rounded-full bg-white/70" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-4 text-xs text-white/80">
                <span className="rounded-full bg-black/30 px-3 py-1">인증 방식</span>
                <span>{track.id === "diet" ? "식단 사진 + 칼로리 기록" : "운동 캘린더 + 심박/체중 업로드"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel grid gap-8 rounded-3xl border border-white/5 bg-white/5 p-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-200">HOW IT WORKS</p>
            <h3 className="mt-2 text-2xl font-bold text-white">인증 흐름</h3>
            <p className="mt-2 text-sm text-gray-200">사진/로그 인증 → 주간 리포트 → 보상까지 한 흐름에 담았습니다.</p>
            <div className="mt-5 space-y-3">
              {certificationSteps.map((step, idx) => (
                <div key={step.title} className="flex gap-3 rounded-2xl bg-black/30 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">{idx + 1}</div>
                  <div>
                    <p className="font-semibold text-white">{step.title}</p>
                    <p className="text-sm text-gray-300">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-black/40 p-6 shadow-lg">
            <p className="text-sm font-semibold text-pink-200">신청하기</p>
            <h4 className="mt-1 text-xl font-bold text-white">트랙 선택 후 신청서를 제출하세요</h4>
            <div className="mt-4 space-y-3">
              <label className="text-sm text-gray-200">
                이름
                <input
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none"
                  placeholder="홍길동"
                />
              </label>
              <label className="text-sm text-gray-200">
                이메일
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none"
                  placeholder="you@example.com"
                />
              </label>
              <label className="text-sm text-gray-200">
                목표
                <textarea
                  name="goal"
                  required
                  value={form.goal}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none"
                  rows={3}
                  placeholder="예) 체지방 5kg 감량, 식단 루틴 만들기"
                />
              </label>
              <label className="text-sm text-gray-200">
                트랙 선택
                <select
                  name="track"
                  value={form.track}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none"
                >
                  <option value="diet" className="bg-slate-900 text-white">식단방</option>
                  <option value="fitness" className="bg-slate-900 text-white">다이어트반</option>
                </select>
              </label>
              <label className="text-sm text-gray-200">
                참여 약속
                <input
                  name="commitment"
                  value={form.commitment}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none"
                  placeholder="주 4회 이상 인증, 휴식일 1회"
                />
              </label>
            </div>
            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:shadow-pink-500/30"
            >
              신청하기
            </button>
            {submitted && <p className="mt-3 text-center text-sm text-emerald-200">신청이 접수되었습니다! 담당자가 확인 후 안내드릴게요.</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
