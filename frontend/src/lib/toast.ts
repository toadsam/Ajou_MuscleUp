// 앱 전체에서 쓰는 짧은 알림(토스트). window.alert 대신 쓴다.
//
//   toast("저장했어요")
//   toast("사진을 올리지 못했어요. 다시 시도해 주세요.", "error")
//
// React 밖(이벤트 핸들러, 유틸)에서도 부를 수 있게 DOM 에 직접 그린다. 짐 플로어(v2) 스타일.

export type ToastKind = "info" | "success" | "error";

const ROOT_ID = "dg-toast-root";
const COLORS: Record<ToastKind, string> = {
  info: "var(--dg-steel, #26272b)",
  success: "var(--dg-green, #2e9c55)",
  error: "var(--dg-red, #d9302a)",
};

function root() {
  let el = document.getElementById(ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ROOT_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      transform: "translateX(-50%)",
      zIndex: "100000",
      display: "grid",
      gap: "8px",
      width: "min(92vw, 420px)",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message: string, kind: ToastKind = "info", ms = 2600) {
  if (typeof document === "undefined") return;
  const item = document.createElement("div");
  item.textContent = message;
  Object.assign(item.style, {
    padding: "11px 14px",
    border: "3px solid var(--dg-ink, #0e0e10)",
    borderRadius: "6px",
    background: COLORS[kind],
    color: kind === "success" ? "var(--dg-ink, #0e0e10)" : "var(--dg-chalk, #eeece6)",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "1.45",
    boxShadow: "0 4px 0 var(--dg-ink, #0e0e10)",
    wordBreak: "keep-all",
    transition: "opacity .25s, transform .25s",
    opacity: "0",
    transform: "translateY(8px)",
  });
  root().appendChild(item);
  requestAnimationFrame(() => {
    item.style.opacity = "1";
    item.style.transform = "none";
  });
  window.setTimeout(() => {
    item.style.opacity = "0";
    window.setTimeout(() => item.remove(), 300);
  }, ms);
}
