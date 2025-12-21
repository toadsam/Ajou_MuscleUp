const leads = [
  {
    name: "정재훈",
    role: "대표 / 헤드코치",
    focus: "전략, 커뮤니티, 퍼포먼스",
    quote: "근거 기반의 훈련과 따뜻한 커뮤니티가 성장의 핵심입니다.",
  },
  {
    name: "권상어",
    role: "부대표",
    focus: "운영, 회원 경험, 파트너십",
    quote: "회원 여정 전반을 설계해 최고의 경험을 만듭니다.",
  },
  {
    name: "김현중",
    role: "총무",
    focus: "콘텐츠, 미디어, 스토리텔링",
    quote: "운동의 순간을 기록하고, 이야기를 담아 가치로 만듭니다.",
  },
  {
    name: "유수정",
    role: "테크 리드, 총관리자",
    focus: "플랫폼, 데이터, AI",
    quote: "데이터로 개인화된 운동 경험을 설계합니다.",
  },
];

export default function Executives() {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="glow-orb absolute -left-24 top-0 h-72 w-72 rounded-full bg-pink-500/30" />
      <div className="glow-orb absolute right-0 top-20 h-96 w-80 rounded-full bg-purple-500/30" />
      <div className="relative mx-auto max-w-6xl space-y-10">
        <header className="text-center space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-200">Leadership</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">운영진 소개</h1>
          <p className="text-gray-300">
            전략·운영·콘텐츠·테크 각 분야의 리더들이 모여 회원 경험을 설계합니다.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {leads.map((m) => (
            <div
              key={m.name}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur hover:shadow-pink-500/30 transition"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10" />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{m.name}</h3>
                    <p className="text-pink-300 font-semibold">{m.role}</p>
                  </div>
                  <div className="text-xs rounded-full bg-white/10 px-3 py-1 border border-white/10 text-gray-100">
                    {m.focus}
                  </div>
                </div>
                <p className="text-gray-200 leading-relaxed italic">“{m.quote}”</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
