export default function About() {
  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-10">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center">득근득근 소개</h1>

        <p className="text-gray-300 text-lg leading-relaxed text-center">
          득근득근은 운동을 사랑하는 사람들이 함께 성장하는 커뮤니티입니다. 우리는
          과학적이고 지속 가능한 방법으로 운동과 영양을 배우고, 서로의 목표 달성을
          응원합니다.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "미션",
              desc:
                "운동과 영양의 올바른 지식을 공유하고, 꾸준한 실천을 돕는 문화를 만듭니다.",
            },
            {
              title: "핵심 가치",
              desc: "지속성, 근거 기반, 동료성장. 보여주기식이 아닌 장기적 성장을 추구합니다.",
            },
            {
              title: "활동",
              desc:
                "공동구매, 후기 공유, AI 맞춤 가이드 실험, 스터디/오프라인 운동 번개 등",
            },
          ].map((b) => (
            <div
              key={b.title}
              className="rounded-2xl bg-gray-800/70 backdrop-blur-md p-6 border border-white/5"
            >
              <h3 className="text-xl font-bold mb-2">{b.title}</h3>
              <p className="text-gray-300">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <a
            href="/register"
            className="inline-block px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90"
          >
            함께하기
          </a>
        </div>
      </div>
    </section>
  );
}

