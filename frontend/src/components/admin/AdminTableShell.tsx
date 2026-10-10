import type { ReactNode } from "react";

export default function AdminTableShell({
  title,
  description,
  loading,
  hasData,
  emptyMessage,
  onRefresh,
  actionSlot,
  children,
}: {
  title: string;
  description?: string;
  loading: boolean;
  hasData: boolean;
  emptyMessage: string;
  onRefresh?: () => void;
  actionSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dg-steel space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-chalk">{title}</h3>
          {description ? <p className="text-sm text-steel-400">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actionSlot}
          {onRefresh ? (
            <button type="button" onClick={onRefresh} className="dg-btn dg-btn-steel px-3 py-1.5 text-sm">
              새로고침
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-3 text-sm text-steel-400" role="status">
          <span className="dg-loading-plates" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          불러오는 중
        </div>
      ) : hasData ? (
        children
      ) : (
        <p className="dg-well px-4 py-6 text-center text-sm text-steel-400">{emptyMessage}</p>
      )}
    </div>
  );
}
