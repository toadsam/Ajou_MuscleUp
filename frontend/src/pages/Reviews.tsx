export default function Reviews() {
  const reviews = [
    { user: "홍길동", text: "시설이 넓고 기구가 다양해서 좋았어요!", stars: 4 },
    { user: "김민지", text: "트레이너 분들이 친절해서 만족합니다.", stars: 5 },
    { user: "이철수", text: "가격 대비 시설이 조금 아쉬워요.", stars: 3 },
  ];

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <h2 className="text-4xl font-extrabold mb-12 text-center">
        헬스장 후기
      </h2>

      <div className="space-y-6 max-w-2xl mx-auto">
        {reviews.map((r, i) => (
          <div
            key={i}
            className="bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 shadow hover:shadow-pink-500/40 transition"
          >
            <p className="font-semibold text-lg">{r.user}</p>
            <p className="text-gray-300 mt-2">{r.text}</p>
            <div className="mt-3 text-pink-400">
              {"⭐".repeat(r.stars) + "☆".repeat(5 - r.stars)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
