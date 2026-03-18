import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminTableShell from "../../components/admin/AdminTableShell";
import AdminToast from "../../components/admin/AdminToast";
import { useAdminToast } from "../../components/admin/useAdminToast";
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

const eventAdminKey = (status: "" | EventStatus, q: string, page: number) => ["admin", "events", status, q, page] as const;

export default function AdminEventsList() {
  const [status, setStatus] = useState<"" | EventStatus>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const queryClient = useQueryClient();
  const { toast, showError, showSuccess, clearToast } = useAdminToast();

  const listQuery = useQuery<EventPageResponse<EventItem>>({
    queryKey: eventAdminKey(status, q, page),
    queryFn: () => eventApi.getAdminList({ status: status || undefined, q: q || undefined, page, size: 10 }),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: EventStatus }) => eventApi.patchStatus(id, nextStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      showSuccess("이벤트 상태를 변경했습니다.");
    },
    onError: (e: any) => showError(e?.response?.data?.message || "상태 변경에 실패했습니다."),
  });

  const toggleMain = useMutation({
    mutationFn: ({ id, current }: { id: number; current: boolean }) => eventApi.patchMainBanner(id, !current),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      showSuccess("메인배너 설정을 변경했습니다.");
    },
    onError: (e: any) => showError(e?.response?.data?.message || "설정 변경에 실패했습니다."),
  });

  const togglePin = useMutation({
    mutationFn: ({ id, current }: { id: number; current: boolean }) => eventApi.patchPin(id, !current),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      showSuccess("핀 고정 설정을 변경했습니다.");
    },
    onError: (e: any) => showError(e?.response?.data?.message || "설정 변경에 실패했습니다."),
  });

  const removeEvent = useMutation({
    mutationFn: (id: number) => eventApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      showSuccess("이벤트를 삭제했습니다.");
    },
    onError: (e: any) => showError(e?.response?.data?.message || "삭제에 실패했습니다."),
  });

  const items = listQuery.data?.content ?? [];
  const totalPages = listQuery.data?.totalPages ?? 0;

  const isMutating = useMemo(
    () => patchStatus.isPending || toggleMain.isPending || togglePin.isPending || removeEvent.isPending,
    [patchStatus.isPending, toggleMain.isPending, togglePin.isPending, removeEvent.isPending],
  );

  return (
    <section className="min-h-screen bg-slate-950 pb-24 pt-28 text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-6 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-cyan-300">ADMIN</p>
            <h1 className="text-3xl font-extrabold">이벤트 관리</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">대시보드</Link>
            <Link to="/admin/events/new" className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-900">새 이벤트 생성</Link>
          </div>
        </header>

        <AdminTableShell
          title="이벤트 목록"
          description="react-query 기반 캐시/재시도/무효화 적용"
          loading={listQuery.isLoading}
          hasData={items.length > 0}
          emptyMessage="검색 결과가 없습니다."
          onRefresh={() => void listQuery.refetch()}
          actionSlot={
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as "" | EventStatus);
                  setPage(0);
                }}
                className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm"
                placeholder="제목 검색"
              />
              <button type="button" onClick={() => setPage(0)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
                검색
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/10 text-left">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">제목</th>
                  <th className="p-3">상태</th>
                  <th className="p-3">기간</th>
                  <th className="p-3">메인배너</th>
                  <th className="p-3">핀고정</th>
                  <th className="p-3">우선순위</th>
                  <th className="p-3">업데이트</th>
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
                        onChange={(e) => patchStatus.mutate({ id: item.id, nextStatus: e.target.value as EventStatus })}
                        disabled={isMutating}
                        className="rounded bg-slate-900 px-2 py-1 disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                          <option key={option.value} value={option.value}>{option.value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">{new Date(item.startAt).toLocaleDateString("ko-KR")} ~ {new Date(item.endAt).toLocaleDateString("ko-KR")}</td>
                    <td className="p-3"><button type="button" onClick={() => toggleMain.mutate({ id: item.id, current: item.isMainBanner })} className="rounded bg-white/10 px-2 py-1">{item.isMainBanner ? "ON" : "OFF"}</button></td>
                    <td className="p-3"><button type="button" onClick={() => togglePin.mutate({ id: item.id, current: item.isPinned })} className="rounded bg-white/10 px-2 py-1">{item.isPinned ? "ON" : "OFF"}</button></td>
                    <td className="p-3">{item.priority}</td>
                    <td className="p-3">{item.updatedAt ? new Date(item.updatedAt).toLocaleString("ko-KR") : "-"}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link to={`/admin/events/${item.id}/edit`} className="rounded bg-cyan-600 px-2 py-1">수정</Link>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = window.confirm("이 이벤트를 삭제할까요?");
                            if (!ok) return;
                            const keyword = window.prompt("삭제를 계속하려면 DELETE 를 입력하세요.");
                            if (keyword !== "DELETE") return;
                            removeEvent.mutate(item.id);
                          }}
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

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setPage((prev) => Math.max(0, prev - 1))} disabled={page <= 0} className="rounded bg-white/10 px-3 py-1 disabled:opacity-40">이전</button>
              <span>{page + 1} / {totalPages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))} disabled={page + 1 >= totalPages} className="rounded bg-white/10 px-3 py-1 disabled:opacity-40">다음</button>
            </div>
          ) : null}
        </AdminTableShell>
      </div>

      <AdminToast toast={toast} onClose={clearToast} />
    </section>
  );
}
