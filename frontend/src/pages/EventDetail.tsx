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
    return (
      <section className="flex min-h-screen items-start gap-3 pt-28 px-6 text-white">
        <span className="dg-loading-plates" aria-label="불러오는 중">
          <i />
          <i />
          <i />
          <i />
        </span>
        로딩 중...
      </section>
    );
  }
  if (error || !event) {
    return <section className="min-h-screen pt-28 px-6 text-red-200">{error || "이벤트를 찾을 수 없습니다."}</section>;
  }

  return (
    <section className="min-h-screen pt-28 pb-24 text-white">
      <div className="mx-auto max-w-4xl px-6 lg:px-10 space-y-6">
        <img
          src={event.bannerUrl || event.thumbnailUrl}
          alt={event.title}
          className="dg-rise w-full rounded-2xl border-[3px] border-black object-cover shadow-xl"
        />

        <div className="dg-rise space-y-2" style={{ animationDelay: "80ms" }}>
          <h1 className="text-4xl">{event.title}</h1>
          <p className="text-steel-300">{event.summary}</p>
          <p className="font-num text-base font-semibold text-steel-400">{formatPeriod(event.startAt, event.endAt)}</p>
          <span className="dg-chip bg-plate-yellow text-sm text-black">{event.status}</span>
        </div>

        <article
          className="dg-steel prose prose-invert max-w-none p-6"
          dangerouslySetInnerHTML={{ __html: event.content }}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCta}
            className="dg-btn dg-btn-primary"
          >
            {event.ctaText}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="dg-btn dg-btn-steel"
          >
            링크 복사
          </button>
        </div>
      </div>
    </section>
  );
}
