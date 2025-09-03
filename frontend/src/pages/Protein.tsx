export default function Protein() {
  const products = [
    { name: "웨이 프로틴 초코맛", price: 45000, days: 3 },
    { name: "웨이 프로틴 바닐라맛", price: 46000, days: 5 },
    { name: "식물성 프로틴 그린맛", price: 42000, days: 7 },
  ];

  return (
    <section className="pt-32 p-12 bg-gray-50 min-h-screen">
      <h2 className="text-4xl font-extrabold mb-12 text-center text-gray-900">
        프로틴 공동구매
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {products.map((p) => (
          <div
            key={p.name}
            className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg hover:scale-105 transition"
          >
            <h3 className="text-xl font-bold mb-2">{p.name}</h3>
            <p className="text-gray-600">
              ₩{p.price.toLocaleString()} | 남은 기간: {p.days}일
            </p>
            <div className="mt-6">
              <button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                참여하기
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
