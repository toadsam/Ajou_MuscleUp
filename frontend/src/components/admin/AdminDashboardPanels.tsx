import type { Dispatch, ReactNode, SetStateAction } from "react";
import AdminTableShell from "./AdminTableShell";
import { useCountUp } from "../../hooks/useCountUp";
import { useInView } from "../../hooks/useInView";

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

// 신청 상태 값(PENDING 등)은 그대로 두고, 화면에는 사람이 읽는 이름을 보여 준다.
const APPLICATION_STATUS_LABEL: Record<Application["status"], string> = {
  PENDING: "대기",
  REVIEWING: "검토 중",
  APPROVED: "승인",
  REJECTED: "반려",
};

// 예전 그라데이션 클래스(from-pink-500 …)로 넘어오는 색을 원판 단색으로 바꾼다.
// Tailwind 가 클래스를 찾을 수 있도록 결과는 모두 고정 문자열이다.
function plateTone(colorClasses: string) {
  if (/(emerald|green|teal|lime)/.test(colorClasses)) return { bar: "bg-plate-green", text: "text-green-300" };
  if (/(sky|blue)/.test(colorClasses)) return { bar: "bg-plate-blue", text: "text-blue-300" };
  if (/(cyan|amber|yellow)/.test(colorClasses)) return { bar: "bg-plate-yellow", text: "text-yellow-300" };
  if (/(pink|rose|red|fuchsia|purple|violet|indigo)/.test(colorClasses)) return { bar: "bg-plate-red", text: "text-red-300" };
  return { bar: "bg-steel-500", text: "text-steel-300" };
}

function CountUpValue({ value, start }: { value: number; start: boolean }) {
  const current = useCountUp(value, { duration: 900, start });
  return <>{Math.round(current).toLocaleString("ko-KR")}</>;
}

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
  const [ref, inView] = useInView<HTMLDivElement>();
  const tone = plateTone(accent);
  return (
    <div ref={ref} className="dg-steel dg-lift relative overflow-hidden p-5">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 border-b-2 border-black ${tone.bar}`} />
      <p className="mt-1 text-sm font-semibold text-steel-300">{title}</p>
      <p className="mt-2 font-num text-4xl leading-none text-chalk">
        {typeof value === "number" ? <CountUpValue value={value} start={inView} /> : <span className="font-display text-2xl">{value}</span>}
      </p>
      <p className="mt-2 text-xs text-steel-400">{desc}</p>
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
  // 데이터가 늦게 와도 관찰이 끊기지 않도록 항상 그려지는 바깥 칸을 본다.
  const [ref, inView] = useInView<HTMLDivElement>();
  const tone = plateTone(color);
  return (
    <div ref={ref}>
      <AdminTableShell
        title={title}
        description={subtitle}
        loading={false}
        hasData={items.length > 0}
        emptyMessage="데이터가 없습니다."
      >
        <ul className="space-y-3 text-sm">
          {items.map((item, idx) => (
            <li key={item.action} className="dg-rise space-y-1" style={{ animationDelay: `${Math.min(idx, 12) * 50}ms` }}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-chalk">
                  <span className="mr-2 font-num text-steel-500">{idx + 1}</span>
                  {item.action}
                </span>
                <span className={`font-num text-lg ${tone.text}`}>
                  <CountUpValue value={item.count} start={inView} />
                </span>
              </div>
              {/* 처음 보일 때 막대가 차오른다 */}
              <div className="h-3 overflow-hidden rounded border-2 border-black bg-steel-950">
                <div
                  className={`h-full transition-[width] duration-700 ease-out ${tone.bar}`}
                  style={{
                    width: inView ? `${Math.max(8, (item.count / Math.max(1, max)) * 100)}%` : "0%",
                    transitionDelay: `${Math.min(idx, 12) * 50}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </AdminTableShell>
    </div>
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
          <div key={app.id} className="dg-well p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-chalk">{app.name}</p>
                <p className="text-xs text-steel-300">{app.email}</p>
              </div>
              <span className="dg-chip bg-steel-700 text-chalk">{app.track}</span>
            </div>
            <p className="mt-2 text-xs text-steel-400">{new Date(app.createdAt).toLocaleString("ko-KR")}</p>
            <p className="mt-2 text-sm text-steel-200">목표: {app.goal}</p>
            <p className="text-sm text-steel-400">참여 의지: {app.commitment}</p>
            <select
              value={app.status}
              onChange={(e) => onChangeStatus(app.id, e.target.value as Application["status"])}
              disabled={changingStatusIds.has(app.id)}
              className="mt-3 w-full rounded-md border-2 border-black bg-steel-900 px-3 py-2 text-sm text-chalk focus:outline-none focus-visible:border-plate-yellow disabled:opacity-60"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABEL[status] ?? status}
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
          <div key={item.id} className="dg-well flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="text-sm text-chalk">
              <p>{item.authorNickname || "회원"} · {item.date}</p>
              <p className="text-xs text-steel-400">응원 {item.cheerCount} · 신고 {item.reportCount}</p>
            </div>
            {item.hiddenByAdmin ? (
              <button
                type="button"
                onClick={() => onShow(item.id)}
                disabled={processingId === item.id}
                className="dg-btn bg-plate-green px-3 py-1 text-xs text-white"
              >
                공개
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onHide(item.id)}
                disabled={processingId === item.id}
                className="dg-btn dg-btn-primary px-3 py-1 text-xs"
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
