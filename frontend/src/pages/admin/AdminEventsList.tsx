import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminTableShell from "../../components/admin/AdminTableShell";
import AdminToast from "../../components/admin/AdminToast";
import { useAdminToast } from "../../components/admin/useAdminToast";
import { eventApi } from "../../services/eventApi";
import type { EventItem, EventPageResponse, EventStatus } from "../../types/event";

// 값(DRAFT 등)은 그대로, 화면 라벨만 사람이 읽는 말로
const STATUS_OPTIONS: Array<{ value: "" | EventStatus; label: string }> = [
  { value: "", label: "전체" },
  { value: "DRAFT", label: "작성 중" },
  { value: "SCHEDULED", label: "예약" },
  { value: "ACTIVE", label: "진행 중" },
  { value: "ENDED", label: "종료" },
  { value: "HIDDEN", label: "숨김" },
];

function ToggleChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`rounded border-2 border-black px-2 py-0.5 text-xs font-bold shadow-[0_2px_0_#0E0E10] transition active:translate-y-0.5 active:shadow-none ${
        on ? "bg-plate-green text-white" : "bg-steel-700 text-steel-300"
      }`}
    >
      {on ? "켜짐" : "꺼짐"}
    </button>
  );
}

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
    <section className="min-h-screen pb-24 pt-28 text-chalk">
      <div className="mx-auto max-w-7xl space-y-6 px-6 lg:px-10">
        <header className="dg-steel dg-rise relative flex flex-wrap items-end justify-between gap-3 overflow-hidden p-5">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 border-b-2 border-black bg-plate-red" />
          <div>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-plate-yellow">
              운영 관제실 <span className="font-num text-xs tracking-wide text-steel-500">ADMIN</span>
            </p>
            <h1 className="text-3xl">이벤트 관리</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="dg-btn dg-btn-steel px-4 py-2 text-sm">대시보드</Link>
            <Link to="/admin/events/new" className="dg-btn dg-btn-primary px-4 py-2 text-sm">새 이벤트 생성</Link>
          </div>
        </header>

        <AdminTableShell
          title="이벤트 목록"
          description="상태·메인배너·핀 고정을 목록에서 바로 바꿀 수 있어요"
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
                aria-label="상태 필터"
                className="rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-3 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-3 py-1.5 text-sm"
                aria-label="제목 검색"
                placeholder="제목 검색"
              />
              <button type="button" onClick={() => setPage(0)} className="dg-btn dg-btn-steel px-3 py-1.5 text-sm">
                검색
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto rounded-md border-2 border-black bg-steel-900">
            <table className="min-w-full text-sm">
              <thead className="border-b-2 border-black bg-steel-950 text-left text-steel-300">
                <tr>
                  <th className="p-3">번호</th>
                  <th className="p-3">제목</th>
                  <th className="p-3">모임</th>
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
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="dg-rise border-t border-steel-800 transition-colors hover:bg-steel-800"
                    style={{ animationDelay: `${idx * 45}ms` }}
                  >
                    <td className="p-3 font-num text-base text-steel-400">{item.id}</td>
                    <td className="p-3 font-semibold">{item.title}</td>
                    <td className="p-3">
                      {item.gymName ? (
                        <span className="dg-chip whitespace-nowrap bg-plate-blue text-xs text-white">{item.gymName}</span>
                      ) : (
                        <span className="whitespace-nowrap text-xs text-steel-400">앱 전체</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={item.status}
                        onChange={(e) => patchStatus.mutate({ id: item.id, nextStatus: e.target.value as EventStatus })}
                        disabled={isMutating}
                        aria-label={`${item.title} 상태`}
                        className="rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-2 py-1 disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">{new Date(item.startAt).toLocaleDateString("ko-KR")} ~ {new Date(item.endAt).toLocaleDateString("ko-KR")}</td>
                    <td className="p-3"><ToggleChip on={item.isMainBanner} label={`${item.title} 메인배너`} onClick={() => toggleMain.mutate({ id: item.id, current: item.isMainBanner })} /></td>
                    <td className="p-3"><ToggleChip on={item.isPinned} label={`${item.title} 핀 고정`} onClick={() => togglePin.mutate({ id: item.id, current: item.isPinned })} /></td>
                    <td className="p-3 font-num text-base">{item.priority}</td>
                    <td className="p-3">{item.updatedAt ? new Date(item.updatedAt).toLocaleString("ko-KR") : "-"}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link to={`/admin/events/${item.id}/edit`} className="dg-btn dg-btn-steel px-2 py-1 text-xs">수정</Link>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = window.confirm("이 이벤트를 삭제할까요?");
                            if (!ok) return;
                            const keyword = window.prompt("삭제를 계속하려면 DELETE 를 입력하세요.");
                            if (keyword !== "DELETE") return;
                            removeEvent.mutate(item.id);
                          }}
                          className="dg-btn dg-btn-primary px-2 py-1 text-xs"
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
              <button type="button" onClick={() => setPage((prev) => Math.max(0, prev - 1))} disabled={page <= 0} className="dg-btn dg-btn-steel px-3 py-1 text-xs">이전</button>
              <span className="font-num text-sm text-steel-300">{page + 1} / {totalPages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))} disabled={page + 1 >= totalPages} className="dg-btn dg-btn-steel px-3 py-1 text-xs">다음</button>
            </div>
          ) : null}
        </AdminTableShell>
      </div>

      <AdminToast toast={toast} onClose={clearToast} />
    </section>
  );
}
