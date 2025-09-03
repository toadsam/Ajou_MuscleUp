import { useState } from "react";

export default function Reviews() {
  const [reviews, setReviews] = useState([
    { 
      user: "홍길동", 
      gym: "강남 피트니스", 
      text: "시설이 넓고 기구가 다양해서 좋았어요!", 
      stars: 4, 
      image: "/sample-gym1.jpg" 
    },
    { 
      user: "김민지", 
      gym: "신촌 헬스장", 
      text: "트레이너 분들이 친절해서 만족합니다.", 
      stars: 5, 
      image: "/sample-gym2.jpg" 
    },
  ]);

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <h2 className="text-4xl font-extrabold mb-12 text-center">헬스장 후기</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {reviews.map((r, i) => (
          <div
            key={i}
            className="bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow hover:shadow-pink-500/40 transition"
          >
            {/* 사진 */}
            <img
              src={r.image}
              alt={`${r.gym} 사진`}
              className="w-full h-48 object-cover"
            />

            <div className="p-6">
              <p className="font-bold text-xl">{r.gym}</p>
              <p className="text-sm text-gray-400">{r.user}</p>
              <div className="mt-2 text-pink-400">
                {"⭐".repeat(r.stars) + "☆".repeat(5 - r.stars)}
              </div>
              <p className="mt-4 text-gray-300">{r.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <a
          href="/reviews/write"
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg font-semibold hover:opacity-90 transition"
        >
          리뷰 작성하기
        </a>
      </div>
    </section>
  );
}
