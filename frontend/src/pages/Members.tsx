type Member = {
  name: string;
  role: string;
  bio: string;
  tags: string[];
  vibe: string;
};

const members: Member[] = [
  {
    name: "김유석",
    role: "스트렝스 코치",
    bio: "파워 기반 근력 프로그램을 설계하고 자세 안정화 루틴을 코칭합니다.",
    tags: ["파워리프팅", "자세교정", "중량관리"],
    vibe: "Strength Lab",
  },
  {
    name: "박채린",
    role: "모빌리티 코치",
    bio: "움직임 가동성과 유연성을 함께 올려 부상 리스크를 줄이는 데 집중합니다.",
    tags: ["모빌리티", "가동성", "재활예방"],
    vibe: "Flow Motion",
  },
  {
    name: "이서연",
    role: "영양 코치",
    bio: "운동 목표와 생활 패턴을 반영해 지속 가능한 식단 전략을 설계합니다.",
    tags: ["영양관리", "다이어트", "벌크업"],
    vibe: "Fuel System",
  },
  {
    name: "김현준",
    role: "커뮤니티 매니저",
    bio: "멤버 이벤트, 챌린지, 온보딩을 설계해 참여 경험의 밀도를 높입니다.",
    tags: ["이벤트", "온보딩", "커뮤니티"],
    vibe: "Crew Pulse",
  },
  {
    name: "최하민",
    role: "콘텐츠 디자이너",
    bio: "브랜드 톤에 맞는 비주얼 스토리텔링으로 멤버들의 성장을 기록합니다.",
    tags: ["브랜딩", "영상", "스토리텔링"],
    vibe: "Visual Craft",
  },
  {
    name: "정도윤",
    role: "데이터 분석가",
    bio: "운동 로그와 인바디 지표를 기반으로 개인화된 추천 인사이트를 제공합니다.",
    tags: ["데이터", "AI 추천", "리포팅"],
    vibe: "Insight Engine",
  },
];

const highlights = [
  { label: "전문 코치", value: "06" },
  { label: "운영 프로그램", value: "18+" },
  { label: "월간 챌린지", value: "12" },
] as const;

export default function Members() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/35 p-6 shadow-[0_20px_70px_-35px_rgba(16,185,129,0.65)] md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
          <p className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            Team Members
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">멤버 소개</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
            코칭, 영양, 데이터, 콘텐츠까지 각자의 전문성이 연결되어 더 좋은 운동 경험을 만듭니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <p className="text-xs text-slate-300">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-emerald-100">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, idx) => (
            <article
              key={m.name}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-[0_16px_40px_-30px_rgba(45,212,191,0.8)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-transparent opacity-90" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
                      Member {String(idx + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold">{m.name}</h3>
                    <p className="text-sm font-semibold text-emerald-200">{m.role}</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                    {m.vibe}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-200">{m.bio}</p>

                <div className="flex flex-wrap gap-2 text-xs">
                  {m.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-cyan-200/25 bg-cyan-500/10 px-3 py-1 text-cyan-50 transition group-hover:border-cyan-200/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
