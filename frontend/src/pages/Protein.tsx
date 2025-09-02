export default function Protein() {
  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6">🥤 프로틴 공동구매</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-xl font-bold">웨이 프로틴 초코맛</h3>
          <p className="text-gray-600">₩45,000 | 남은 기간: 3일</p>
          <button className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            참여하기
          </button>
        </div>
        {/* 더미 카드 복붙 가능 */}
      </div>
    </div>
  );
}
