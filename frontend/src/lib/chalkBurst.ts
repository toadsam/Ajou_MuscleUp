// 주요 버튼(.dg-btn-primary)이나 .dg-chalk-burst 요소를 누르면 손에서 초크 가루가 튄다.
// 화면 전체에 리스너 하나만 단다. 움직임 줄이기 설정이면 아무것도 하지 않는다.

const SELECTOR = ".dg-btn-primary, .dg-chalk-burst";
const PARTICLES = 10;

export function spawnChalk(x: number, y: number) {
  const layer = document.createElement("div");
  layer.className = "dg-chalk-layer";
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  for (let i = 0; i < PARTICLES; i += 1) {
    const dot = document.createElement("span");
    const angle = (Math.PI * 2 * i) / PARTICLES + Math.random() * 0.5;
    const distance = 18 + Math.random() * 26;
    dot.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * distance - 8}px`);
    dot.style.setProperty("--s", `${3 + Math.random() * 4}px`);
    layer.appendChild(dot);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 650);
}

export function installChalkBurst() {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (reduce?.matches) return;
      const target = event.target as Element | null;
      if (!target?.closest?.(SELECTOR)) return;
      spawnChalk(event.clientX, event.clientY);
    },
    { passive: true },
  );
}
