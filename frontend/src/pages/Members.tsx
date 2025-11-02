type Member = {
  name: string;
  role: string;
  bio: string;
};

const members: Member[] = [
  {
    name: "윤채영",
    role: "사모님 / 부회장 여자친구",
    bio: "석세스짐 인포 / 헬린이",
  },
  {
    name: "김민석",
    role: "광대 / 기계..",
    bio: "축구 좋아함 / 맨날 아픔",
  },
  {
    name: "연서은",
    role: "천계 마스터",
    bio: "기본 운동 2시간 / 페이스풀 50",
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
          득근득근
        </p>
      </div>
    </section>
  );
}

