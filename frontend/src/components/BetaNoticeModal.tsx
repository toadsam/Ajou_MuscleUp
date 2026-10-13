import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// 베타 안내 — 헤더 아래 한 줄 띠. 예전에는 화면을 덮는 창이라 처음 온 사람의 첫 행동이 "닫기"였다
// (docs/fixes/2026-10-13-first-run-ux.md #1). 화면을 막지 않고, 닫으면 이 안내 버전은 다시 안 뜬다.
// 헤더가 fixed 라 띠도 헤더 바로 아래 fixed 로 두고, 띠 높이만큼 <main> 을 내린다(--beta-h, App.tsx).

// 안내 내용을 바꾸면 이 값도 바꾼다. "닫기"를 누른 사람에게도 새 안내가 한 번 다시 뜬다.
const NOTICE_VERSION = "2026-10-beta";

const HIDE_UNTIL_KEY = "beta_notice_hide_until";
const DISMISSED_VERSION_KEY = "beta_notice_dismissed_version";

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
  // 예전 "오늘 하루 보지 않기"로 숨긴 사람은 그 시간까지 그대로 둔다
  const hideUntil = Number(readStorage(HIDE_UNTIL_KEY) ?? 0);
  return !(Number.isFinite(hideUntil) && hideUntil > Date.now());
}

export default function BetaNoticeModal() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const quiet = QUIET_PATHS.some((re) => re.test(location.pathname));

  useEffect(() => {
    if (quiet) return;
    if (shouldShow()) setOpen(true);
  }, [quiet]);

  const barRef = useRef<HTMLDivElement>(null);
  const shown = open && !quiet;
  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    const header = document.querySelector("header");
    if (!shown || !bar) {
      root.style.removeProperty("--beta-h");
      return;
    }
    const measure = () => {
      bar.style.top = `${header?.offsetHeight ?? 0}px`;
      root.style.setProperty("--beta-h", `${bar.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    if (header) ro.observe(header);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--beta-h");
    };
  }, [shown]);

  const dismiss = () => {
    writeStorage(DISMISSED_VERSION_KEY, NOTICE_VERSION);
    setOpen(false);
  };

  if (!shown) return null;

  return (
    <div ref={barRef} role="note" aria-label="베타 서비스 안내" className="fixed inset-x-0 z-40 border-b-2 border-black bg-steel-800 text-chalk">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <span className="dg-chip shrink-0 bg-plate-yellow text-black">BETA</span>
        <p className="min-w-0 flex-1 text-xs leading-snug text-steel-300">베타 서비스라 오류가 있을 수 있어요. 불편한 점은 "?"로 알려 주세요.</p>
        <button type="button" onClick={dismiss} className="dg-btn dg-btn-steel shrink-0 px-3 py-1 text-xs">
          닫기
        </button>
      </div>
    </div>
  );
}
