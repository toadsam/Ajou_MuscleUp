import { useState, useEffect } from "react";

const images = [
  //"/상어-DeolQ-Cw",
  //"/재건이형-SdK5N_0C",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
  
  "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca",
];

const stats = [
  { label: "활동 멤버", value: "180+" },
  { label: "주간 세션", value: "45" },
  { label: "커뮤니티 챌린지", value: "24" },
];

const features = [
  {
    title: "맞춤 루틴",
    desc: "AI 분석으로 체형과 컨디션에 맞는 루틴을 추천합니다.",
    icon: "💪",
    accent: "from-pink-500/50 to-orange-500/30",
  },
  {
    title: "실시간 케어",
    desc: "전문 운영진이 24시간 질문과 자세 피드백을 도와드립니다.",
    icon: "🧠",
    accent: "from-purple-500/50 to-indigo-500/30",
  },
  {
    title: "공동구매",
    desc: "믿을 수 있는 보충제와 용품을 회원 전용 특가로 만나보세요.",
    icon: "🛒",
    accent: "from-blue-500/50 to-teal-500/30",
  },
];

const quickLinks = [
  { label: "AI득근으로 분석하기", to: "/ai", color: "from-pink-500 to-purple-500" },
  { label: "부원 후기 보기", to: "/reviews", color: "from-indigo-500 to-blue-500" },
  { label: "임원진에게 문의하기", to: "/executives", color: "from-amber-500 to-pink-500" },
];

const liveHighlights = [
  {
    badge: "AI",
    title: "루틴 분석",
    detail: "92% 진행",
    color: "from-emerald-400/10 to-cyan-400/10",
  },
  {
    badge: "챌린지",
    title: "스쿼트 30일",
    detail: "DAY 12",
    color: "from-pink-500/10 to-purple-400/10",
  },
  {
    badge: "케어",
    title: "심박 데이터",
    detail: "실시간 동기화",
    color: "from-blue-500/10 to-indigo-400/10",
  },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="glow-orb absolute -left-32 top-0 h-72 w-72 rounded-full bg-pink-500/40 animate-float-slow" />
      <div className="glow-orb absolute right-0 top-32 h-96 w-72 rounded-full bg-purple-500/30 pulse-glow" />
      <div className="glow-orb absolute -bottom-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/30" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 pb-16 pt-28 lg:flex-row lg:items-center lg:gap-20 lg:px-10">
        <div className="z-10 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            새로운 시즌 챌린지 오픈!
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            득근에서 <br />
            <span className="text-gradient text-glow">함께 성장</span>하고
            <br />
            기록을 새로 쓰세요
          </h1>
          <p className="mt-6 max-w-2xl text-base text-gray-300 sm:text-lg">
            운동 목표 달성을 위한 가장 강력한 커뮤니티. AI 피드백부터 루틴 공유, 공동구매까지 모두 한 번에 경험하세요.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="/protein" className="btn-gradient px-8 py-3 text-base sm:text-lg">
              지금 시작하기
            </a>
            <a href="/members" className="btn-outline px-8 py-3 text-base sm:text-lg">
              멤버 둘러보기
            </a>
          </div>
          <div className="mt-12 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <p className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="absolute inset-0 hidden lg:block">
            <div className="absolute left-1/2 top-6 h-32 w-32 -translate-x-1/2 rounded-full border border-white/10 animate-spin-slower" />
            <div className="absolute right-8 top-1/3 h-20 w-20 rounded-full border border-white/20 animate-orbit" />
          </div>
          <div className="glass-panel relative w-full max-w-lg overflow-hidden">
            {images.map((src, index) => (
              <img
                key={src}
                src={`${src}?auto=format&fit=crop&w=1400&q=80`}
                alt="운동 이미지"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                  index === currentIndex ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            <div className="relative z-10 flex flex-col gap-4 p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-1 text-sm text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                실시간 AI 코칭 허브
              </div>
              <p className="text-3xl font-semibold text-white">AI 컨트롤 센터</p>
              <p className="text-sm text-gray-200">지금 124명의 멤버가 AI 피드백을 받고 있어요.</p>
              <div className="mt-2 space-y-3">
                {liveHighlights.map((highlight) => (
                  <div
                    key={highlight.title}
                    className={`rounded-2xl border border-white/10 bg-gradient-to-r ${highlight.color} p-4 text-sm text-white backdrop-blur`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-white/80">{highlight.badge}</span>
                      <span className="text-emerald-200">{highlight.detail}</span>
                    </div>
                    <p className="mt-1 text-lg font-semibold">{highlight.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="glass-panel absolute -bottom-10 left-4 w-52 animate-orbit p-4 text-sm text-white shadow-2xl">
            <p className="text-xs text-gray-300">오늘의 추천 루틴</p>
            <p className="text-lg font-semibold">HIIT 12분</p>
            <p className="text-emerald-300">심박 안정화 + 지방 연소</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="glass-panel relative overflow-hidden p-6">
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-30`} />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-200">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.to}
              className={`rounded-2xl bg-gradient-to-r ${link.color} p-5 text-center text-base font-semibold text-white shadow-xl transition hover:scale-[1.02]`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
