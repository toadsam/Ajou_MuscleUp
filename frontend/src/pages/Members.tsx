type Member = {
  name: string;
  role: string;
  bio: string;
  tags: string[];
};

const members: Member[] = [
  {
    name: "김민석",
    role: "스트렝스 코치",
    bio: "파워리프팅 국가대표 출신, 안전한 중량 훈련과 자세 교정 전문.",
    tags: ["파워", "자세교정", "중량"],
  },
  {
    name: "윤채영",
    role: "필라테스·모빌리티",
    bio: "체형 교정과 유연성 향상에 초점, 부상 예방 루틴 설계.",
    tags: ["필라테스", "모빌리티", "교정"],
  },
  {
    name: "연서은",
    role: "영양 코치",
    bio: "체구성 변화 맞춤 식단, 실생활에 적용 가능한 가이드 제공.",
    tags: ["영양", "다이어트", "증량"],
  },
  {
    name: "김상겸",
    role: "커뮤니티 매니저",
    bio: "회원 온보딩·이벤트 기획, 참여형 챌린지 운영.",
    tags: ["커뮤니티", "이벤트", "온보딩"],
  },
  {
    name: "서하늘",
    role: "미디어 크리에이터",
    bio: "브랜디드 콘텐츠와 하이라이트 영상 제작, 스토리텔링 강화.",
    tags: ["영상", "콘텐츠", "스토리"],
  },
  {
    name: "한도현",
    role: "데이터·AI",
    bio: "운동/식단 로그 기반 개인화 추천과 대시보드 개발.",
    tags: ["데이터", "AI", "추천"],
  },
];

export default function Members() {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="glow-orb absolute -left-16 top-10 h-60 w-60 rounded-full bg-emerald-500/20" />
      <div className="glow-orb absolute right-0 top-24 h-72 w-72 rounded-full bg-blue-500/20" />
      <div className="relative mx-auto max-w-6xl space-y-10">
        <header className="text-center space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">Team</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">멤버 소개</h1>
          <p className="text-gray-300">전문 코치부터 크리에이터까지, 서로의 강점을 연결해 최고의 경험을 만듭니다.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((m) => (
            <div
              key={m.name}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur hover:shadow-emerald-400/30 transition"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-blue-500/10" />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{m.name}</h3>
                    <p className="text-emerald-200 font-semibold">{m.role}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-bold">
                    {m.name.slice(0, 1)}
                  </div>
                </div>
                <p className="text-gray-200 leading-relaxed">{m.bio}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full bg-black/40 border border-white/10 px-3 py-1 text-gray-100">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
