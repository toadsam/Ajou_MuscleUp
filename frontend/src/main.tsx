import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { bootstrapAuthSession, installFetchAuth } from "./lib/installFetchAuth";
import { queryClient } from "./lib/queryClient";

installFetchAuth();
void bootstrapAuthSession();

function showPwaUpdateToast(onConfirm: () => void) {
  const existing = document.getElementById("pwa-update-toast");
  if (existing) return;

  const toast = document.createElement("div");
  toast.id = "pwa-update-toast";
  toast.style.position = "fixed";
  toast.style.left = "16px";
  toast.style.right = "16px";
  toast.style.bottom = "16px";
  toast.style.zIndex = "99999";
  toast.style.padding = "12px 14px";
  toast.style.borderRadius = "12px";
  toast.style.background = "rgba(11, 17, 35, 0.95)";
  toast.style.border = "1px solid rgba(120, 221, 255, 0.45)";
  toast.style.color = "#e9f8ff";
  toast.style.fontSize = "14px";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.justifyContent = "space-between";
  toast.style.gap = "10px";
  toast.textContent = "새 버전이 준비됐어요.";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const later = document.createElement("button");
  later.textContent = "나중에";
  later.style.padding = "6px 10px";
  later.style.borderRadius = "8px";
  later.style.border = "1px solid rgba(255,255,255,0.22)";
  later.style.background = "transparent";
  later.style.color = "#d8e5ff";
  later.onclick = () => toast.remove();

  const update = document.createElement("button");
  update.textContent = "지금 업데이트";
  update.style.padding = "6px 10px";
  update.style.borderRadius = "8px";
  update.style.border = "none";
  update.style.background = "linear-gradient(90deg, #2ec5ff, #7f6bff)";
  update.style.color = "#04111a";
  update.style.fontWeight = "700";
  update.onclick = () => {
    toast.remove();
    onConfirm();
  };

  actions.appendChild(later);
  actions.appendChild(update);
  toast.appendChild(actions);
  document.body.appendChild(toast);
}

const updateSW = registerSW({
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
