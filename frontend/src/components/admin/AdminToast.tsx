import { useEffect, type CSSProperties } from "react";

export type AdminToastState = {
  type: "success" | "error";
  message: string;
};

export default function AdminToast({ toast, onClose }: { toast: AdminToastState | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const success = toast.type === "success";

  return (
    <div className="fixed right-4 top-24 z-[70]" role="status" aria-live="polite">
      {/* key 로 메시지가 바뀔 때마다 등장 애니메이션을 다시 튼다 */}
      <div
        key={`${toast.type}-${toast.message}`}
        className="dg-steel dg-plate-in relative overflow-hidden py-3 pl-5 pr-4 text-sm text-chalk"
        style={{ "--from": "60px" } as CSSProperties}
      >
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${success ? "bg-plate-green" : "bg-plate-red"}`} />
        <div className="flex items-center gap-3">
          <span
            className={`dg-pop flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black ${
              success ? "bg-plate-green" : "bg-plate-red"
            } text-white`}
            aria-hidden="true"
          >
            {success ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L19 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                <path d="M12 6v8M12 18h.01" />
              </svg>
            )}
          </span>
          <span className="font-semibold">{success ? "완료" : "오류"}</span>
          <span className="text-steel-300">{toast.message}</span>
          <button type="button" onClick={onClose} className="dg-btn dg-btn-steel px-2 py-0.5 text-xs">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
