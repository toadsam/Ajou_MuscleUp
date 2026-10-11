import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { eventApi, eventStatusLabel } from "../services/eventApi";
import type { EventDetail as EventDetailType } from "../types/event";
import { toast } from "../lib/toast";

function formatPeriod(startAt: string, endAt: string) {
  const start = new Date(startAt).toLocaleString("ko-KR");
  const end = new Date(endAt).toLocaleString("ko-KR");
  return `${start} ~ ${end}`;
}

// 운영진이 쓴 본문 HTML 을 그대로 넣으면 <script>, onerror= 같은 코드가 방문자 브라우저에서 실행될 수 있다.
// DOMPurify 로 서식 태그만 남기고 위험한 태그·속성은 지운다.
const sanitize = (html: string) => DOMPurify.sanitize(html ?? "", { USE_PROFILES: { html: true } });

// 외부 링크는 http(s) 만 연다(javascript: 같은 주소를 막는다).
const isSafeLink = (link?: string | null) => !!link && /^https?:\/\//i.test(link.trim());

function BackLink() {
  return (
    <Link to="/events" className="inline-flex items-center gap-1 text-sm font-bold text-steel-300 hover:text-chalk">
      <span aria-hidden="true">&larr;</span> 이벤트 목록으로
    </Link>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<EventDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerFailed, setBannerFailed] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id || Number.isNaN(Number(id))) {
        setLoading(false);
        setError("");
        setEvent(null);
        return;
      }
      setLoading(true);
      setError("");
      setBannerFailed(false);
      try {
        const detail = await eventApi.getPublicDetail(Number(id));
        setEvent(detail);
        // 조회수 올리기는 실패해도 화면에는 영향이 없다.
        eventApi.increaseView(Number(id)).catch(() => undefined);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
          setEvent(null);
          setError("");
        } else {
          const serverMessage: unknown = e?.response?.data?.message;
          setError(
            typeof serverMessage === "string" && /[가-힣]/.test(serverMessage)
              ? serverMessage
              : "이벤트를 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
          );
        }
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const safeContent = useMemo(() => (event ? sanitize(event.content) : ""), [event]);

  const handleCta = async () => {
    if (!event || !isSafeLink(event.ctaLink)) return;
    try {
      await eventApi.increaseClick(event.id);
    } catch {
      // 클릭 수 기록 실패는 무시하고 링크는 연다
    } finally {
      window.open(event.ctaLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("링크를 복사했어요.", "success");
    } catch {
      toast("링크를 복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요.", "error");
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen px-6 pt-28 text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 text-steel-300">
          <span className="dg-loading-plates" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          불러오는 중...
        </div>
      </section>
    );
  }

  if (error || !event) {
    return (
      <section className="min-h-screen px-6 pt-28 text-white">
        <div className="mx-auto max-w-4xl space-y-4">
          <BackLink />
          <div className={`dg-steel border-l-[8px] p-6 ${error ? "border-l-plate-red" : "border-l-steel-500"}`}>
            <p className="font-display text-2xl text-chalk">{error ? "이벤트를 불러오지 못했어요" : "찾는 이벤트가 없어요"}</p>
            <p className="mt-2 text-sm text-steel-300">
              {error || "끝났거나 지워진 이벤트일 수 있어요. 목록에서 다른 이벤트를 확인해 보세요."}
            </p>
            <Link to="/events" className="dg-btn dg-btn-steel mt-4 inline-flex min-h-[40px] px-4 text-sm">
              이벤트 목록 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const bannerSrc = event.bannerUrl || event.thumbnailUrl;
  const showCta = isSafeLink(event.ctaLink) && !!event.ctaText?.trim();

  return (
    <section className="min-h-screen pt-28 pb-24 text-white">
      <div className="mx-auto max-w-4xl px-6 lg:px-10 space-y-6">
        <BackLink />

        {bannerSrc && !bannerFailed && (
          <img
            src={bannerSrc}
            alt={event.title}
            onError={() => setBannerFailed(true)}
            className="dg-rise w-full rounded-2xl border-[3px] border-black object-cover shadow-xl"
          />
        )}

        <div className="dg-rise space-y-2" style={{ animationDelay: "80ms" }}>
          <h1 className="text-4xl">{event.title}</h1>
          <p className="text-steel-300">{event.summary}</p>
          <p className="font-num text-base font-semibold text-steel-400">{formatPeriod(event.startAt, event.endAt)}</p>
          <span className="dg-chip bg-plate-yellow text-sm text-black">{eventStatusLabel(event.status)}</span>
        </div>

        {safeContent.trim() && (
          <article
            className="dg-steel prose prose-invert max-w-none p-6"
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />
        )}

        <div className="flex flex-wrap gap-3">
          {showCta && (
            <button
              type="button"
              onClick={handleCta}
              className="dg-btn dg-btn-primary"
            >
              {event.ctaText}
            </button>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="dg-btn dg-btn-steel"
          >
            링크 복사
          </button>
          <Link to="/events" className="dg-btn dg-btn-steel">
            목록으로
          </Link>
        </div>
      </div>
    </section>
  );
}
