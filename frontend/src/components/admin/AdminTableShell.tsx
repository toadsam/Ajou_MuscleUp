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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {description ? <p className="text-sm text-gray-300">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actionSlot}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-100 hover:bg-white/10"
            >
              새로고침
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
        </div>
      ) : hasData ? (
        children
      ) : (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      )}
    </div>
  );
}
