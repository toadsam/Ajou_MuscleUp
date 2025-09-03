import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

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

const BASE = import.meta.env.VITE_API_BASE ?? "";

export default function ProteinDetail() {
  const { id } = useParams();              // /proteins/:id 에서 id 추출
  const navigate = useNavigate();
  const [data, setData] = useState<Protein | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const url = (BASE ? `${BASE}` : "") + `/api/proteins/${id}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Protein = await res.json();
        setData(json);
      } catch (e: any) {
        setErr(e.message ?? "불러오기에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <section className="pt-32 p-12 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        <p className="text-center text-gray-300">불러오는 중…</p>
      </section>
    );
  }

  if (err || !data) {
    return (
      <section className="pt-32 p-12 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        <div className="max-w-3xl mx-auto bg-gray-800/70 p-8 rounded-2xl">
          <p className="text-red-400 mb-6">{err ?? "데이터가 없습니다."}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
          >
            ← 뒤로가기
          </button>
        </div>
      </section>
    );
  }

  const rating = data.avgRating ?? 0;
  const progress = Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));

  return (
    <section className="pt-32 p-12 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      <div className="max-w-3xl mx-auto bg-gray-800/70 backdrop-blur-md p-8 rounded-2xl shadow-xl">
        {data.imageUrl && (
          <img src={data.imageUrl} alt={data.name} className="w-full h-64 object-cover rounded-xl mb-6" />
        )}

        <h1 className="text-3xl font-extrabold mb-3">{data.name}</h1>
        <p className="text-lg mb-1">₩{data.price?.toLocaleString() ?? "-"}</p>
        <p className="mb-1">남은 기간: <span className="text-green-400">{data.days ?? "-"}</span>일</p>
        <p className="mb-1">목표 인원: {data.goal ?? "-"}</p>
        <p className="mb-4">카테고리: {data.category ?? "-"}</p>

        <div className="mt-4 mb-6">
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

        {data.description && (
          <div className="mt-6 text-gray-200 whitespace-pre-wrap">{data.description}</div>
        )}

        <div className="mt-8 flex gap-3">
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">
            ← 목록으로
          </button>
          <Link
            to="/protein"
            className="px-4 py-2 rounded bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90"
          >
            프로틴 목록
          </Link>
        </div>
      </div>
    </section>
  );
}
