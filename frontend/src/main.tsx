import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { bootstrapAuthSession, installFetchAuth } from "./lib/installFetchAuth";
import { queryClient } from "./lib/queryClient";
import { installChalkBurst } from "./lib/chalkBurst";

installFetchAuth();
installChalkBurst();
void bootstrapAuthSession();

function isSafariBrowser() {
  const ua = navigator.userAgent;
  const hasSafari = /Safari/i.test(ua);
  const excluded = /Chrome|CriOS|EdgiOS|FxiOS|OPiOS|SamsungBrowser/i.test(ua);
  return hasSafari && !excluded;
}

async function disableServiceWorkerForSafari() {
  if (!("serviceWorker" in navigator) || !isSafariBrowser()) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    // Safari can keep a previously controlling SW alive for this tab until
    // the next hard navigation. Force one reload only once to detach control.
    if (navigator.serviceWorker.controller) {
      const key = "safari_sw_detached_once";
      if (sessionStorage.getItem(key) !== "1") {
        sessionStorage.setItem(key, "1");
        window.location.replace(window.location.href);
      }
    }
  } catch {
    // ignore
  }
}

async function disableServiceWorkerInDev() {
  if (!import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
    if (navigator.serviceWorker.controller) {
      const key = "dev_sw_detached_once_v2";
      if (sessionStorage.getItem(key) !== "1") {
        sessionStorage.setItem(key, "1");
        window.location.replace(window.location.href);
      }
    }
  } catch {
    // ignore
  }
}

function showPwaUpdateToast(onConfirm: () => void) {
  const existing = document.getElementById("pwa-update-toast");
  if (existing) return;

  // 짐 플로어(v2): 볼트 철판 바탕 + 검은 테두리 + 아래로 떨어지는 단단한 그림자, 주요 행동은 빨강(25kg 원판)
  const toast = document.createElement("div");
  toast.id = "pwa-update-toast";
  toast.setAttribute("role", "status");
  Object.assign(toast.style, {
    position: "fixed",
    left: "16px",
    right: "16px",
    bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    zIndex: "99999",
    maxWidth: "480px",
    margin: "0 auto",
    padding: "12px 14px",
    borderRadius: "6px",
    background: "var(--dg-steel, #26272b)",
    border: "3px solid var(--dg-ink, #0e0e10)",
    boxShadow: "0 5px 0 var(--dg-ink, #0e0e10)",
    color: "var(--dg-chalk, #eeece6)",
    fontSize: "14px",
    fontWeight: "700",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  });
  toast.textContent = "새 버전이 준비됐어요.";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const buttonBase = {
    minHeight: "40px",
    padding: "6px 12px",
    borderRadius: "6px",
    border: "3px solid var(--dg-ink, #0e0e10)",
    boxShadow: "0 3px 0 var(--dg-ink, #0e0e10)",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
  };

  const later = document.createElement("button");
  later.type = "button";
  later.textContent = "나중에";
  Object.assign(later.style, buttonBase, {
    background: "var(--dg-steel-hi, #3a3d43)",
    color: "var(--dg-chalk, #eeece6)",
  });
  later.onclick = () => toast.remove();

  const update = document.createElement("button");
  update.type = "button";
  update.textContent = "지금 업데이트";
  Object.assign(update.style, buttonBase, {
    background: "var(--dg-red, #d9302a)",
    color: "#ffffff",
  });
  update.onclick = () => {
    toast.remove();
    onConfirm();
  };

  actions.appendChild(later);
  actions.appendChild(update);
  toast.appendChild(actions);
  document.body.appendChild(toast);
}

// 배포가 바뀌어 열려 있던 화면이 찾는 조각 파일(lazy 페이지)이 서버에서 사라졌을 때: 한 번만 새로고침해 새 화면을 받는다.
// 10초 안에 또 실패하면 다시 새로고침하지 않는다(무한 새로고침 방지 — 그때는 오류 화면이 보인다).
window.addEventListener("vite:preloadError", (event) => {
  const key = "preload_error_reload_at";
  try {
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // 저장소를 못 쓰면 한 번만 시도하고 끝(아래 reload 후에는 같은 상황이 반복되지 않는다)
  }
  event.preventDefault();
  window.location.reload();
});

void disableServiceWorkerForSafari();
void disableServiceWorkerInDev();

const updateSW = isSafariBrowser()
  ? (() => {
      // no-op on Safari
    })
  : registerSW({
      immediate: true,
      onNeedRefresh() {
        showPwaUpdateToast(() => updateSW(true));
      },
    });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
