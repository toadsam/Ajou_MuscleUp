export default function Executives() {
  const members = [
    { name: "정재훈", role: "회장", quote: "득근은 사랑입니다!" },
    { name: "권상우", role: "부회장", quote: "모두 함께 성장해요!" },
    { name: "김현중", role: "총무", quote: "든든하게 지원하겠습니다!" },
  ];

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <h2 className="text-4xl font-extrabold mb-12 text-center">
        임원진 소개
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {members.map((m) => (
          <div
            key={m.name}
            className="bg-gray-800/70 backdrop-blur-md rounded-2xl p-8 text-center shadow-lg hover:scale-105 hover:shadow-pink-500/40 transition"
          >
            <div className="w-28 h-28 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl font-bold">
              {m.name[0]}
            </div>
            <h3 className="text-2xl font-semibold">{m.name}</h3>
            <p className="text-pink-400 font-medium">{m.role}</p>
            <p className="italic text-gray-300 mt-4">“{m.quote}”</p>
          </div>
        ))}
      </div>
    </section>
  );
}
