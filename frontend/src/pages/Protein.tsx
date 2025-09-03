import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Protein = {
  id: number;
  name: string;
  price?: number;
  days?: number;
  goal?: number;
  imageUrl?: string;
  description?: string;
  category?: string;
  avgRating?: number | null;
};

// 백엔드가 Page 형태({ content: [...] })로 줄 수도 있어 대응
async function fetchProteins(): Promise<Protein[]> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/proteins`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.content ?? []);
}

export default function Protein() {
  const [products, setProducts] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setProducts(await fetchProteins());
      } catch (e: any) {
        setErr(e.message ?? "로드 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 정렬/필터 버튼 동작(클라이언트 정렬)
  const sortByPriceAsc = () =>
    setProducts(p => [...p].sort((a, b) => (a.price ?? 0) - (b.price ?? 0)));
  const sortByPriceDesc = () =>
    setProducts(p => [...p].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)));
  const sortByDays = () =>
    setProducts(p => [...p].sort((a, b) => (a.days ?? 9e9) - (b.days ?? 9e9)));

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <h2 className="text-4xl font-extrabold mb-12 text-center">🥤 프로틴 공동구매</h2>

      {/* 필터 버튼 */}
      <div className="flex justify-center gap-4 mb-10">
        <button onClick={sortByDays} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
          마감 임박순
        </button>
        <button onClick={sortByPriceAsc} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
          가격 낮은순
        </button>
        <button onClick={sortByPriceDesc} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
          가격 높은순
        </button>
      </div>

      {loading && <p className="text-center text-gray-300">불러오는 중…</p>}
      {err && <p className="text-center text-red-400">{err}</p>}

      {/* 상품 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {products.map((p) => {
          const deadlineColor =
            (p.days ?? 99) <= 3 ? "text-red-400" :
            (p.days ?? 99) <= 5 ? "text-yellow-400" : "text-green-400";

          // 기존 디자인의 progress는 'participants/goal'이었는데,
          // 현재 백엔드엔 participants가 없으므로 일단 평점(0~5)을 0~100%로 변환해 대체 표시
          const rating = p.avgRating ?? 0;
          const progress = Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));

          return (
            <div
              key={p.id}
              className="bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg hover:shadow-pink-500/40 transition hover:scale-105"
            >
              {/* 상품 이미지 */}
              {p.imageUrl && (
                <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-cover" />
              )}

              <div className="p-6">
                <h3 className="text-2xl font-bold mb-2">{p.name}</h3>
                <p className="text-gray-300 mb-2">₩{p.price?.toLocaleString() ?? "-"}</p>
                <p className={`${deadlineColor} font-semibold`}>남은 기간: {p.days ?? "-"}일</p>
                <p className="text-sm text-gray-400">카테고리: {p.category ?? "-"}</p>

                {/* 진행률 바(임시: 평점 기반) */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>평점</span>
                    <span>★ {rating.toFixed(1)} / 5</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* 상세로 이동 (참여 기능은 서버 스펙 정해지면 붙임) */}
                <Link
                  to={`/proteins/${p.id}`}
                  className="mt-6 block w-full text-center px-4 py-3 rounded-lg font-semibold transition bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90"
                >
                  상세 보기
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 등록 페이지 이동 버튼 */}
      <div className="text-center mt-12">
        <Link
          to="/protein/write"
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg font-semibold hover:opacity-90 transition"
        >
          상품 등록하기
        </Link>
      </div>
    </section>
  );
}
