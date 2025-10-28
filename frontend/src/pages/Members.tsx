type Member = {
  name: string;
  role: string;
  bio: string;
};

const members: Member[] = [
  {
    name: "김피트",
    role: "운영진 / 프로그램 기획",
    bio: "근거 기반 훈련 설계와 콘텐츠 제작을 담당합니다.",
  },
  {
    name: "이단백",
    role: "영양 스터디 리드",
    bio: "지속 가능한 식단과 보충제 선택을 함께 공부합니다.",
  },
  {
    name: "박득근",
    role: "커뮤니티 매니저",
    bio: "신입 오리엔테이션, 오프라인 번개 운영을 맡고 있어요.",
  },
  {
    name: "최바벨",
    role: "기록/분석",
    bio: "운동 기록과 정량 분석으로 성장을 돕습니다.",
  },
];

export default function Members() {
  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-10">부원 소개</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {members.map((m) => (
            <div
              key={m.name}
              className="rounded-2xl overflow-hidden bg-gray-800/70 backdrop-blur-md border border-white/5 hover:shadow-pink-500/30 hover:shadow-xl transition"
            >
              <div className="h-32 bg-gradient-to-r from-pink-500/40 to-purple-500/40" />
              <div className="p-6">
                <h3 className="text-2xl font-bold mb-1">{m.name}</h3>
                <p className="text-pink-300 mb-3">{m.role}</p>
                <p className="text-gray-300 leading-relaxed">{m.bio}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-400 mt-10">
          소개는 예시이며, 실제 구성원/프로필은 추후 업데이트하세요.
        </p>
      </div>
    </section>
  );
}

