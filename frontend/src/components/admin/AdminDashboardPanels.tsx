import type { Dispatch, ReactNode, SetStateAction } from "react";
import AdminTableShell from "./AdminTableShell";

export type ActionCount = { action: string; count: number };
export type Application = {
  id: number;
  name: string;
  email: string;
  goal: string;
  track: string;
  commitment: string;
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED";
  createdAt: string;
};
export type ProteinItem = { id: number; name: string };
export type AttendanceShareItem = {
  id: number;
  date: string;
  authorNickname?: string | null;
  cheerCount: number;
  reportCount: number;
  shareSlug?: string | null;
  hiddenByAdmin?: boolean;
};
export type BragItem = { id: number; title: string };

export function StatCard({
  title,
  value,
  desc,
  accent,
}: {
  title: string;
  value: number | string;
  desc: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-20`} />
      <div className="relative">
        <p className="text-sm text-gray-300">{title}</p>
        <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

export function TopListCard({
  title,
  subtitle,
  items,
  max,
  color,
}: {
  title: string;
  subtitle: string;
  items: ActionCount[];
  max: number;
  color: string;
}) {
  return (
    <AdminTableShell
      title={title}
      description={subtitle}
      loading={false}
      hasData={items.length > 0}
      emptyMessage="데이터가 없습니다."
    >
      <ul className="space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.action} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{item.action}</span>
              <span className="text-cyan-100">{item.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-2 rounded-full bg-gradient-to-r ${color}`}
                style={{ width: `${Math.max(8, (item.count / Math.max(1, max)) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </AdminTableShell>
  );
}

export function ApplicationPanel({
  applications,
  loading,
  onRefresh,
  onChangeStatus,
  statuses,
  changingStatusIds,
}: {
  applications: Application[];
  loading: boolean;
  onRefresh: () => void;
  onChangeStatus: (id: number, status: Application["status"]) => void;
  statuses: Application["status"][];
  changingStatusIds: Set<number>;
}) {
  return (
    <AdminTableShell
      title="프로그램 신청"
      description="신청 목록 확인과 상태 변경"
      loading={loading}
      hasData={applications.length > 0}
      emptyMessage="신청 내역이 없습니다."
      onRefresh={onRefresh}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {applications.map((app) => (
          <div key={app.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{app.name}</p>
                <p className="text-xs text-gray-300">{app.email}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs">{app.track}</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">{new Date(app.createdAt).toLocaleString("ko-KR")}</p>
            <p className="mt-2 text-sm text-gray-200">목표: {app.goal}</p>
            <p className="text-sm text-gray-400">참여 의지: {app.commitment}</p>
            <select
              value={app.status}
              onChange={(e) => onChangeStatus(app.id, e.target.value as Application["status"])}
              disabled={changingStatusIds.has(app.id)}
              className="mt-3 w-full rounded-lg border border-gray-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </AdminTableShell>
  );
}

export function MediaPanel({
  title,
  description,
  loading,
  hasData,
  onRefresh,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  hasData: boolean;
  onRefresh: () => void;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <AdminTableShell
      title={title}
      description={description}
      loading={loading}
      hasData={hasData}
      emptyMessage={emptyMessage}
      onRefresh={onRefresh}
    >
      {children}
    </AdminTableShell>
  );
}

export function AttendanceSharePanel({
  items,
  loading,
  onRefresh,
  onHide,
  onShow,
  processingId,
}: {
  items: AttendanceShareItem[];
  loading: boolean;
  onRefresh: () => void;
  onHide: (id: number) => void;
  onShow: (id: number) => void;
  processingId: number | null;
}) {
  return (
    <AdminTableShell
      title="출석 공유 운영"
      description="신고/응원 수를 보고 비공개 처리"
      loading={loading}
      hasData={items.length > 0}
      emptyMessage="출석 공유 항목이 없습니다."
      onRefresh={onRefresh}
    >
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-sm text-white">
              <p>{item.authorNickname || "회원"} · {item.date}</p>
              <p className="text-xs text-gray-400">응원 {item.cheerCount} · 신고 {item.reportCount}</p>
            </div>
            {item.hiddenByAdmin ? (
              <button
                type="button"
                onClick={() => onShow(item.id)}
                disabled={processingId === item.id}
                className="rounded-full bg-emerald-500/80 px-3 py-1 text-xs text-white disabled:opacity-60"
              >
                공개
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onHide(item.id)}
                disabled={processingId === item.id}
                className="rounded-full bg-red-500/80 px-3 py-1 text-xs text-white disabled:opacity-60"
              >
                비공개
              </button>
            )}
          </div>
        ))}
      </div>
    </AdminTableShell>
  );
}

export function toChangingSet(
  setState: Dispatch<SetStateAction<Set<number>>>,
  id: number,
  add: boolean,
) {
  setState((prev) => {
    const next = new Set(prev);
    if (add) next.add(id);
    else next.delete(id);
    return next;
  });
}
