import { useEffect } from "react";

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

  const tone =
    toast.type === "success"
      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
      : "border-rose-300/40 bg-rose-500/15 text-rose-100";

  return (
    <div className="fixed right-4 top-24 z-[70]">
      <div className={`rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${tone}`}>
        <div className="flex items-center gap-3">
          <span className="font-semibold">{toast.type === "success" ? "완료" : "오류"}</span>
          <span>{toast.message}</span>
          <button type="button" onClick={onClose} className="rounded-md border border-white/20 px-2 py-0.5 text-xs hover:bg-white/10">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
