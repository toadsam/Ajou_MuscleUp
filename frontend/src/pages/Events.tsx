import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { eventApi } from "../services/eventApi";
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

const toLabel = (status: EventStatus) => {
  if (status === "ACTIVE") return "진행중";
  if (status === "SCHEDULED") return "예정";
  return "종료";
};

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
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 space-y-10">
        <header>
          <p className="text-cyan-300 text-sm font-semibold">EVENT</p>
          <h1 className="text-4xl font-extrabold">🎉 이벤트</h1>
          <p className="mt-2 text-gray-300">진행중/예정/종료 이벤트를 확인해보세요.</p>
        </header>

        {SECTIONS.map((status) => {
          const section = state[status];
          return (
            <div key={status} className="space-y-4">
              <h2 className="text-2xl font-bold">{toLabel(status)}</h2>

              {section.loading && <p className="text-gray-300">로딩 중...</p>}
              {!section.loading && section.error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-300">{section.error}</p>
              )}
              {!section.loading && !section.error && section.items.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-gray-400">등록된 이벤트가 없습니다.</p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {section.items.map((event) => (
                  <article
                    key={event.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 shadow-xl"
                  >
                    <img src={event.thumbnailUrl} alt={event.title} className="h-44 w-full object-cover" />
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="line-clamp-1 text-lg font-bold">{event.title}</h3>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                          {status === "ACTIVE" ? getDday(event.endAt) : toLabel(event.status)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-300">{event.summary}</p>
                      <p className="text-xs text-gray-400">{formatPeriod(event.startAt, event.endAt)}</p>
                      <Link
                        to={`/events/${event.id}`}
                        className="inline-flex rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
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
                    className="rounded-lg bg-white/10 px-3 py-1 text-sm disabled:opacity-40"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-300">
                    {section.page + 1} / {section.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadSection(status, section.page + 1)}
                    disabled={section.page + 1 >= section.totalPages || section.loading}
                    className="rounded-lg bg-white/10 px-3 py-1 text-sm disabled:opacity-40"
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
