import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// 안내 내용을 바꾸면 이 값도 바꾼다. "닫기"를 누른 사람에게도 새 안내가 한 번 다시 뜬다.
const NOTICE_VERSION = "2026-10-beta";

const HIDE_UNTIL_KEY = "beta_notice_hide_until";
const DISMISSED_VERSION_KEY = "beta_notice_dismissed_version";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 공유 카드처럼 처음 오는 사람이 바로 내용을 봐야 하는 화면, 로그인, 개발용 화면에서는 띄우지 않는다
const QUIET_PATHS = [/^\/attendance\/share\//, /^\/ai\/share\//, /^\/login(\/|$)/, /^\/dev\//];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장소를 못 쓰면 이번 방문에서만 닫힌다 */
  }
}

function shouldShow(): boolean {
  if (readStorage(DISMISSED_VERSION_KEY) === NOTICE_VERSION) return false;
  const hideUntil = Number(readStorage(HIDE_UNTIL_KEY) ?? 0);
  return !(Number.isFinite(hideUntil) && hideUntil > Date.now());
}

export default function BetaNoticeModal() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const quiet = QUIET_PATHS.some((re) => re.test(location.pathname));

  useEffect(() => {
    if (quiet) return;
    if (shouldShow()) setOpen(true);
  }, [quiet]);

  const close = useCallback(() => {
    setOpen(false);
    returnFocusRef.current?.focus?.();
  }, []);

  // 닫기: 이 안내 버전은 다시 띄우지 않는다
  const dismiss = () => {
    writeStorage(DISMISSED_VERSION_KEY, NOTICE_VERSION);
    close();
  };

  const closeForToday = () => {
    writeStorage(HIDE_UNTIL_KEY, String(Date.now() + ONE_DAY_MS));
    close();
  };

  // 열릴 때 포커스를 안으로 옮기고, Esc 로 닫고, Tab 이 창 밖으로 나가지 않게 가둔다
  useEffect(() => {
    if (!open || quiet) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        writeStorage(DISMISSED_VERSION_KEY, NOTICE_VERSION);
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, quiet, close]);

  if (!open || quiet) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-notice-title"
        aria-describedby="beta-notice-desc"
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
        <p id="beta-notice-desc" className="mt-4 text-sm leading-relaxed text-steel-300">
          현재 베타 서비스로, 오류나 버그가 발생할 수 있습니다.
          <br />
          너른 양해 부탁드립니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={dismiss} className="dg-btn dg-btn-steel px-4 py-2 text-sm">
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
