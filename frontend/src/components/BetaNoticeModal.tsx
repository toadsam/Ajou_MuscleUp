import { useEffect, useState } from "react";

const HIDE_UNTIL_KEY = "beta_notice_hide_until";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getHideUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(HIDE_UNTIL_KEY);
  if (!raw) return 0;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    window.localStorage.removeItem(HIDE_UNTIL_KEY);
    return 0;
  }
  return parsed;
}

export default function BetaNoticeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hideUntil = getHideUntil();
    if (hideUntil > Date.now()) return;
    setOpen(true);
  }, []);

  const closeForToday = () => {
    const until = Date.now() + ONE_DAY_MS;
    window.localStorage.setItem(HIDE_UNTIL_KEY, String(until));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-md rounded-2xl border border-cyan-300/40 bg-[#0b1123] p-6 text-slate-100 shadow-2xl">
        <h2 className="text-lg font-bold text-cyan-200">베타 서비스 안내</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          현재 베타 서비스로, 오류나 버그가 발생할 수 있습니다.
          <br />
          너른 양해 부탁드립니다.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-400/40 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700/40"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={closeForToday}
            className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200"
          >
            오늘 하루 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
