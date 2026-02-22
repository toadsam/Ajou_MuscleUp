import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { eventApi } from "../services/eventApi";
import type { EventDetail as EventDetailType } from "../types/event";

function formatPeriod(startAt: string, endAt: string) {
  const start = new Date(startAt).toLocaleString("ko-KR");
  const end = new Date(endAt).toLocaleString("ko-KR");
  return `${start} ~ ${end}`;
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<EventDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const detail = await eventApi.getPublicDetail(Number(id));
        setEvent(detail);
        await eventApi.increaseView(Number(id));
      } catch (e: any) {
        setError(e?.response?.data?.message || "이벤트를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const handleCta = async () => {
    if (!event) return;
    try {
      await eventApi.increaseClick(event.id);
    } catch {
      // no-op
    } finally {
      window.open(event.ctaLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    alert("링크를 복사했습니다.");
  };

  if (loading) {
    return <section className="min-h-screen bg-slate-950 pt-28 px-6 text-white">로딩 중...</section>;
  }
  if (error || !event) {
    return <section className="min-h-screen bg-slate-950 pt-28 px-6 text-red-300">{error || "이벤트를 찾을 수 없습니다."}</section>;
  }

  return (
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto max-w-4xl px-6 lg:px-10 space-y-6">
        <img
          src={event.bannerUrl || event.thumbnailUrl}
          alt={event.title}
          className="w-full rounded-2xl border border-white/10 object-cover"
        />

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold">{event.title}</h1>
          <p className="text-gray-300">{event.summary}</p>
          <p className="text-sm text-gray-400">{formatPeriod(event.startAt, event.endAt)}</p>
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{event.status}</span>
        </div>

        <article
          className="prose prose-invert max-w-none rounded-2xl border border-white/10 bg-white/5 p-5"
          dangerouslySetInnerHTML={{ __html: event.content }}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCta}
            className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            {event.ctaText}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-semibold hover:bg-white/10"
          >
            링크 복사
          </button>
        </div>
      </div>
    </section>
  );
}
