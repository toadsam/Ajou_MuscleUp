import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { eventApi } from "../../services/eventApi";
import type { EventItem, EventPageResponse, EventStatus } from "../../types/event";

const STATUS_OPTIONS: Array<{ value: "" | EventStatus; label: string }> = [
  { value: "", label: "전체" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "SCHEDULED", label: "SCHEDULED" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "ENDED", label: "ENDED" },
  { value: "HIDDEN", label: "HIDDEN" },
];

export default function AdminEventsList() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [status, setStatus] = useState<"" | EventStatus>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const res: EventPageResponse<EventItem> = await eventApi.getAdminList({
        status: status || undefined,
        q: q || undefined,
        page: nextPage,
        size: 10,
      });
      setItems(res.content);
      setPage(res.number);
      setTotalPages(res.totalPages);
    } catch (e: any) {
      setError(e?.response?.data?.message || "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
  }, []);

  const handleStatusPatch = async (id: number, nextStatus: EventStatus) => {
    await eventApi.patchStatus(id, nextStatus);
    await load(page);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await eventApi.remove(id);
    await load(page);
  };

  const handleToggleMain = async (id: number, current: boolean) => {
    await eventApi.patchMainBanner(id, !current);
    await load(page);
  };

  const handleTogglePin = async (id: number, current: boolean) => {
    await eventApi.patchPin(id, !current);
    await load(page);
  };

  return (
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cyan-300">ADMIN</p>
            <h1 className="text-3xl font-extrabold">이벤트 관리</h1>
          </div>
          <Link to="/admin/events/new" className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-900">
            새 이벤트 생성
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | EventStatus)}
            className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 md:col-span-2"
            placeholder="제목 검색"
          />
          <button
            type="button"
            onClick={() => void load(0)}
            className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/20"
          >
            검색
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-500/10 p-3 text-red-300">{error}</p>}
        {loading && <p>로딩 중...</p>}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full text-sm">
            <thead className="bg-white/10 text-left">
              <tr>
                <th className="p-3">id</th>
                <th className="p-3">title</th>
                <th className="p-3">status</th>
                <th className="p-3">기간</th>
                <th className="p-3">isMainBanner</th>
                <th className="p-3">isPinned</th>
                <th className="p-3">priority</th>
                <th className="p-3">updatedAt</th>
                <th className="p-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="p-3">{item.id}</td>
                  <td className="p-3">{item.title}</td>
                  <td className="p-3">
                    <select
                      value={item.status}
                      onChange={(e) => void handleStatusPatch(item.id, e.target.value as EventStatus)}
                      className="rounded bg-slate-900 px-2 py-1"
                    >
                      {STATUS_OPTIONS.filter((o) => o.value).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    {new Date(item.startAt).toLocaleDateString("ko-KR")} ~ {new Date(item.endAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleMain(item.id, item.isMainBanner)}
                      className="rounded bg-white/10 px-2 py-1"
                    >
                      {item.isMainBanner ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => void handleTogglePin(item.id, item.isPinned)}
                      className="rounded bg-white/10 px-2 py-1"
                    >
                      {item.isPinned ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="p-3">{item.priority}</td>
                  <td className="p-3">{item.updatedAt ? new Date(item.updatedAt).toLocaleString("ko-KR") : "-"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link to={`/admin/events/${item.id}/edit`} className="rounded bg-cyan-600 px-2 py-1">
                        수정
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded bg-red-600 px-2 py-1"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(page - 1)}
              disabled={page <= 0}
              className="rounded bg-white/10 px-3 py-1 disabled:opacity-40"
            >
              이전
            </button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => void load(page + 1)}
              disabled={page + 1 >= totalPages}
              className="rounded bg-white/10 px-3 py-1 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
