type Lead = {
  name: string;
  role: string;
  focus: string;
  quote: string;
  area: string;
};

const leads: Lead[] = [
  {
    name: "정재훈",
    role: "대표 / 헤드 코치",
    focus: "전략, 퍼포먼스, 커뮤니티 방향성",
    quote: "탄탄한 시스템 위에서 멤버의 작은 성취가 큰 변화로 이어지게 만듭니다.",
    area: "Vision",
  },
  {
    name: "권상우",
    role: "부대표",
    focus: "운영 구조, 파트너십, 멤버 경험",
    quote: "운영의 디테일을 설계해 체감되는 퀄리티를 완성합니다.",
    area: "Operations",
  },
  {
    name: "김세향",
    role: "총무",
    focus: "콘텐츠, 브랜딩, 스토리텔링",
    quote: "운동의 시간을 기록하고 공유 가능한 이야기로 확장합니다.",
    area: "Brand",
  },
  {
    name: "유수빈",
    role: "테크 리드",
    focus: "플랫폼, 데이터, AI 기능",
    quote: "기록과 데이터를 연결해 개인 맞춤형 운동 경험을 만듭니다.",
    area: "Tech",
  },
];

const leadershipStats = [
  { label: "리더십 팀", value: "04" },
  { label: "운영 스프린트", value: "24/yr" },
  { label: "핵심 프로젝트", value: "11" },
] as const;

export default function Executives() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="absolute right-0 top-24 h-96 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-12 left-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="relative overflow-hidden rounded-3xl border border-rose-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/35 p-6 shadow-[0_20px_75px_-35px_rgba(244,63,94,0.75)] md:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-amber-300/20 blur-3xl" />
          <p className="inline-flex rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-100">
            Leadership
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">운영진 소개</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
            전략, 운영, 브랜드, 기술을 이끄는 리더들이 한 방향으로 팀의 성장을 설계합니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {leadershipStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <p className="text-xs text-slate-300">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-rose-100">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {leads.map((lead, idx) => (
            <article
              key={lead.name}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-[0_16px_45px_-30px_rgba(251,113,133,0.85)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-rose-200/40"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-500/10 via-orange-500/10 to-transparent" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200/90">
                      Executive {String(idx + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold">{lead.name}</h3>
                    <p className="text-sm font-semibold text-rose-200">{lead.role}</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                    {lead.area}
                  </div>
                </div>

                <p className="rounded-xl border border-orange-200/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">{lead.focus}</p>
                <p className="text-sm leading-relaxed text-slate-200 italic">"{lead.quote}"</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
