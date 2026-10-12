// 웹 푸시 알림 켜기 · 끄기. 서버: /api/push. 서비스 워커는 vite-plugin-pwa 가 등록한 것(public/push-sw.js 를 불러옴)을 쓴다.
// iPhone 은 홈 화면에 추가한 앱(iOS 16.4 이상)에서만 웹 알림이 된다.
import { api } from "./api";

export type PushPreferences = { reminder: boolean; weekly: boolean; social: boolean };
export type PushMe = { enabled: boolean; devices: number; preferences: PushPreferences; sentToday: number; dailyCap: number };
type PushConfig = { enabled: boolean; publicKey: string | null };

export type PushSupport = "ok" | "unsupported" | "ios-needs-install" | "denied";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-needs-install" : "unsupported";
  }
  if (ios && !standalone) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  // 서비스 워커가 아직 안 붙었으면(개발 서버 등) 최대 4초 기다린다
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<null>((r) => window.setTimeout(() => r(null), 4000));
  return (await Promise.race([ready, timeout])) as ServiceWorkerRegistration | null;
}

/** 이 기기가 지금 구독 중인지 */
export async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** 알림 켜기 — 버튼을 누른 그 순간에 불러야 권한 창이 뜬다 */
export async function enablePush(): Promise<PushMe> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림을 허용하지 않았어요. 브라우저 설정에서 이 사이트 알림을 허용해 주세요.");
  const config = (await api.get<PushConfig>("/api/push/config")).data;
  if (!config.enabled || !config.publicKey) throw new Error("알림을 준비하고 있어요. 조금 뒤에 다시 켜 주세요.");
  const reg = await registration();
  if (!reg) throw new Error("앱을 한 번 새로고침한 뒤 다시 켜 주세요.");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
  }
  const json = sub.toJSON();
  return (await api.post<PushMe>("/api/push/subscribe", { endpoint: json.endpoint, keys: json.keys })).data;
}

/** 이 기기 알림 끄기 */
export async function disablePush(): Promise<PushMe | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  return (await api.post<PushMe>("/api/push/unsubscribe", { endpoint })).data;
}
