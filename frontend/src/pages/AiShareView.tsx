import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

type ShareItem = {
  id: number;
  type?: string;
  question: string;
  answer: string;
  createdAt: string;
  shareSlug: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function AiShareView() {
  const { slug } = useParams();
  const [data, setData] = useState<ShareItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/ai/share/${slug}`);
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const item: ShareItem = await res.json();
        setData(item);
      } catch (e: any) {
        setError(e?.message || "공유된 답변을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-gray-950 via-gray-900 to-black min-h-screen text-white">
        <div className="max-w-3xl mx-auto">불러오는 중...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-gray-950 via-gray-900 to-black min-h-screen text-white">
        <div className="max-w-3xl mx-auto text-red-400">{error || "존재하지 않는 공유 링크입니다."}</div>
      </section>
    );
  }

  return (
    <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-gray-950 via-gray-900 to-black min-h-screen text-white">
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-gray-400">AI 상담 공유</p>
        <h1 className="text-2xl font-bold text-white">공유된 Q&A</h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>{data.type || "CHAT"}</span>
            <span>{formatDate(data.createdAt)}</span>
          </div>
          <p className="text-sm font-semibold text-white">Q. {data.question}</p>
          <p className="whitespace-pre-wrap text-sm text-gray-100">A. {data.answer}</p>
        </div>
        <div className="flex gap-3 text-sm text-gray-200">
          <Link to="/ai" className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-800">
            AI 상담으로 이동
          </Link>
          <button
            className="px-4 py-2 rounded-lg border border-pink-400 text-pink-100 hover:bg-pink-500/10"
            onClick={() => {
              const link = `${window.location.origin}/ai/share/${data.shareSlug}`;
              navigator.clipboard.writeText(link).then(
                () => alert("링크가 클립보드에 복사되었습니다."),
                () => alert("복사에 실패했습니다.")
              );
            }}
          >
            링크 복사
          </button>
        </div>
      </div>
    </section>
  );
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
};
