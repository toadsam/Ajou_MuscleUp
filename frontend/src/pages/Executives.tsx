export default function Executives() {
  const members = [
    { name: "김철수", role: "회장", quote: "득근은 사랑입니다!" },
    { name: "이영희", role: "부회장", quote: "모두 함께 성장해요!" },
    { name: "박민수", role: "총무", quote: "든든하게 지원하겠습니다!" },
  ];

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6">👥 임원진 소개</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {members.map((m) => (
          <div key={m.name} className="bg-white shadow-md rounded-lg p-6 text-center">
            <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <h3 className="text-xl font-bold">{m.name}</h3>
            <p className="text-gray-600">{m.role}</p>
            <p className="italic text-gray-500 mt-2">"{m.quote}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
