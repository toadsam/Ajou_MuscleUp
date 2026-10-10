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
      <section className="min-h-screen px-6 pb-20 pt-32 text-chalk">
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-steel-300">
          <span className="dg-loading-plates" aria-label="불러오는 중"><i /><i /><i /><i /></span>
          불러오는 중...
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="min-h-screen px-6 pb-20 pt-32 text-chalk">
        <div className="dg-steel dg-rise mx-auto max-w-3xl border-l-[8px] border-l-plate-red p-5 text-red-200">
          {error || "존재하지 않는 공유 링크입니다."}
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen px-6 pb-20 pt-32 text-chalk">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="dg-rise">
          <p className="text-sm text-steel-400">AI 상담 공유</p>
          <h1 className="mt-1 text-3xl text-chalk">공유된 Q&A</h1>
        </div>
        <div className="dg-steel dg-rise space-y-4 p-6" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between gap-3 px-2 text-xs text-steel-300">
            <span className="dg-chip bg-plate-yellow text-black">{data.type || "CHAT"}</span>
            <span className="font-num text-sm font-bold">{formatDate(data.createdAt)}</span>
          </div>
          <div className="dg-well border-l-[6px] border-l-plate-blue p-4">
            <p className="text-sm font-semibold text-chalk">
              <span className="mr-1 font-num text-base font-black text-blue-300">Q.</span>
              {data.question}
            </p>
          </div>
          <div className="dg-well border-l-[6px] border-l-plate-red p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-steel-200">
              <span className="mr-1 font-num text-base font-black text-red-300">A.</span>
              {data.answer}
            </p>
          </div>
        </div>
        <div className="dg-rise flex flex-wrap gap-3 text-sm" style={{ animationDelay: "120ms" }}>
          <Link to="/ai" className="dg-btn dg-btn-steel">
            AI 상담으로 이동
          </Link>
          <button
            type="button"
            className="dg-btn dg-btn-primary"
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
