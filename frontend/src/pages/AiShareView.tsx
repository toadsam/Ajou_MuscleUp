import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";

type ShareItem = {
  id: number;
  type?: string;
  question: string;
  answer: string;
  createdAt: string;
  shareSlug: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 서버의 상담 종류 코드(CHAT 등)를 화면용 한국어로. 모르는 값은 "AI 상담".
const TYPE_LABEL: Record<string, string> = { CHAT: "AI 상담", ANALYZE: "체성 분석", ANALYSIS: "체성 분석", PLAN: "루틴 설계" };

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
        if (!res.ok) throw await httpError(res, "공유된 답변을 불러오지 못했어요.");
        const item: ShareItem = await res.json();
        setData(item);
      } catch (e: unknown) {
        setError(friendlyError(e, "공유된 답변을 불러오지 못했어요."));
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
          <h1 className="mt-1 text-3xl text-chalk">공유된 질문과 답변</h1>
        </div>
        <div className="dg-steel dg-rise space-y-4 p-6" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between gap-3 px-2 text-xs text-steel-300">
            <span className="dg-chip bg-plate-yellow text-black">{TYPE_LABEL[(data.type || "CHAT").toUpperCase()] ?? "AI 상담"}</span>
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
                () => toast("링크를 복사했어요.", "success"),
                () => toast("링크를 복사하지 못했어요.", "error")
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
