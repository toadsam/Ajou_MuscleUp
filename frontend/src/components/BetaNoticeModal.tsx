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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-notice-title"
        className="dg-steel dg-pop relative w-full max-w-md overflow-hidden p-6 pt-7 text-chalk"
      >
        {/* 공사 중 안내 띠 */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-2 border-b-2 border-black"
          style={{ background: "repeating-linear-gradient(-45deg, var(--dg-yellow) 0 10px, var(--dg-ink) 10px 20px)" }}
        />
        <div className="flex items-center gap-2">
          <span className="dg-chip bg-plate-yellow text-black">BETA</span>
          <h2 id="beta-notice-title" className="font-display text-xl text-chalk">
            베타 서비스 안내
          </h2>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-steel-300">
          현재 베타 서비스로, 오류나 버그가 발생할 수 있습니다.
          <br />
          너른 양해 부탁드립니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => setOpen(false)} className="dg-btn dg-btn-steel px-4 py-2 text-sm">
            닫기
          </button>
          <button type="button" onClick={closeForToday} className="dg-btn dg-btn-primary px-4 py-2 text-sm">
            오늘 하루 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
