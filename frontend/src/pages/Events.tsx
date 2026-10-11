import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { eventApi, eventStatusLabel } from "../services/eventApi";
import type { EventItem, EventStatus } from "../types/event";

const PAGE_SIZE = 10;
const SECTIONS: EventStatus[] = ["ACTIVE", "SCHEDULED", "ENDED"];

type SectionState = {
  items: EventItem[];
  page: number;
  totalPages: number;
  loading: boolean;
  error: string;
};

const emptySection = (): SectionState => ({
  items: [],
  page: 0,
  totalPages: 0,
  loading: false,
  error: "",
});

// 상태 이름은 services/eventApi.ts 의 eventStatusLabel 하나로 맞춘다(상세 화면과 같은 말).
const toLabel = (status: EventStatus) => eventStatusLabel(status);

function formatPeriod(startAt: string, endAt: string) {
  const start = new Date(startAt).toLocaleDateString("ko-KR");
  const end = new Date(endAt).toLocaleDateString("ko-KR");
  return `${start} ~ ${end}`;
}

function getDday(endAt: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endAt);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "종료";
  if (diffDays === 0) return "D-day";
  return `D-${diffDays}`;
}

export default function Events() {
  const [state, setState] = useState<Record<EventStatus, SectionState>>({
    DRAFT: emptySection(),
    SCHEDULED: emptySection(),
    ACTIVE: emptySection(),
    ENDED: emptySection(),
    HIDDEN: emptySection(),
  });

  const loadSection = async (status: EventStatus, page = 0) => {
    setState((prev) => ({
      ...prev,
      [status]: { ...prev[status], loading: true, error: "" },
    }));
    try {
      const res = await eventApi.getPublicList({ status, page, size: PAGE_SIZE });
      setState((prev) => ({
        ...prev,
        [status]: {
          ...prev[status],
          loading: false,
          items: res.content,
          page: res.number,
          totalPages: res.totalPages,
        },
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        [status]: {
          ...prev[status],
          loading: false,
          error: error?.response?.data?.message || "이벤트를 불러오지 못했습니다.",
        },
      }));
    }
  };

  useEffect(() => {
    SECTIONS.forEach((status) => {
      void loadSection(status, 0);
    });
  }, []);

  return (
    <section className="min-h-screen pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 space-y-10">
        <header>
          <p className="text-sm font-bold text-plate-yellow">소식</p>
          <h1 className="text-4xl">이벤트</h1>
          <p className="mt-2 text-steel-300">진행 중·예정·종료된 이벤트를 확인해 보세요.</p>
        </header>

        {SECTIONS.map((status) => {
          const section = state[status];
          return (
            <div key={status} className="space-y-4">
              <h2 className="flex items-center gap-3 text-2xl font-black">
                <span
                  aria-hidden
                  className={`h-6 w-2.5 rounded-sm border-2 border-black ${
                    status === "ACTIVE" ? "bg-plate-red" : status === "SCHEDULED" ? "bg-plate-blue" : "bg-steel-500"
                  }`}
                />
                {toLabel(status)}
              </h2>

              {section.loading && (
                <p className="flex items-center gap-3 text-steel-300">
                  <span className="dg-loading-plates" aria-label="불러오는 중">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  불러오는 중...
                </p>
              )}
              {!section.loading && section.error && (
                <p className="dg-well border-l-4 border-l-plate-red p-3 text-red-200">{section.error}</p>
              )}
              {!section.loading && !section.error && section.items.length === 0 && (
                <p className="dg-well p-4 text-steel-400">등록된 이벤트가 없습니다.</p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {section.items.map((event, idx) => (
                  <article
                    key={event.id}
                    className="dg-steel dg-lift dg-rise overflow-hidden"
                    style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
                  >
                    {event.thumbnailUrl && (
                      <img src={event.thumbnailUrl} alt={event.title} className="h-44 w-full border-b-[3px] border-black object-cover" />
                    )}
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="line-clamp-1 text-lg font-bold">{event.title}</h3>
                        <span
                          className={`dg-chip flex-none text-sm ${
                            status === "ACTIVE" ? "bg-plate-yellow text-black" : "bg-steel-700 text-chalk"
                          }`}
                        >
                          {status === "ACTIVE" ? getDday(event.endAt) : toLabel(event.status)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-steel-300">{event.summary}</p>
                      <p className="font-num text-sm font-semibold text-steel-400">{formatPeriod(event.startAt, event.endAt)}</p>
                      <Link
                        to={`/events/${event.id}`}
                        className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm"
                      >
                        자세히 보기
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {section.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadSection(status, section.page - 1)}
                    disabled={section.page <= 0 || section.loading}
                    className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm"
                  >
                    이전
                  </button>
                  <span className="font-num text-base font-bold text-steel-300">
                    {section.page + 1} / {section.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadSection(status, section.page + 1)}
                    disabled={section.page + 1 >= section.totalPages || section.loading}
                    className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
