// 실시간 서버(realtime/, Socket.IO) 연결 공용 설정.
//
// - 주소: VITE_REALTIME_URL. 개발 서버에서만 비어 있을 때 http://localhost:4001 을 쓴다.
//   배포 빌드에서 비어 있으면 null → 라운지·친구 실시간 기능을 끄고 안내만 보여 준다.
// - 입장권: 백엔드 POST /api/realtime/ticket 이 2분짜리 서명 입장권을 준다.
//   socket.io 의 auth 콜백으로 넘기므로 재연결할 때마다 새로 받아 온다.
//   실시간 서버는 이름·레벨·티어·아바타·친구 목록을 이 입장권에서만 읽는다.

import { httpError } from "./httpError";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const RAW_URL = (import.meta.env.VITE_REALTIME_URL ?? "").trim();

export const REALTIME_URL: string | null = RAW_URL || (import.meta.env.DEV ? "http://localhost:4001" : null);

/** 라운지 방: 광장(square) 또는 모임 방(gym:{slug}). 모임 방은 서버가 멤버인지 확인하고 입장권에 넣는다 */
export type LoungeRoom = "square" | `gym:${string}`;

export async function fetchRealtimeTicket(room: LoungeRoom = "square"): Promise<string> {
  const url = API_BASE ? `${API_BASE}/api/realtime/ticket` : "/api/realtime/ticket";
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room }),
  });
  if (!res.ok) throw await httpError(res, "실시간 연결을 준비하지 못했어요.");
  const data = (await res.json()) as { ticket?: unknown };
  if (typeof data.ticket !== "string") throw new Error("실시간 연결을 준비하지 못했어요.");
  return data.ticket;
}

/** io(url, { auth: realtimeAuth }) — 연결·재연결 때마다 새 입장권을 붙인다(광장) */
export function realtimeAuth(cb: (data: object) => void) {
  fetchRealtimeTicket()
    .then((ticket) => cb({ ticket }))
    .catch(() => cb({})); // 입장권 없이 붙으면 서버가 거절한다(개발 모드에서만 손님 입장)
}

/**
 * 라운지용: 고른 방의 입장권. 모임 방 입장권을 못 받으면(멤버에서 빠짐 · 라운지 꺼짐) 광장으로 들어간다.
 * 실제로 들어간 방은 서버의 lounge:welcome { room, roomName } 으로 화면에 보여 준다.
 */
export function realtimeAuthFor(room: LoungeRoom) {
  return (cb: (data: object) => void) => {
    fetchRealtimeTicket(room)
      .catch(() => (room === "square" ? Promise.reject() : fetchRealtimeTicket("square")))
      .then((ticket) => cb({ ticket }))
      .catch(() => cb({}));
  };
}

/** 서버가 연결을 거절한 이유를 화면용 한국어로 */
export function realtimeConnectError(err: { message?: string } | undefined): string {
  if (err?.message === "unauthorized") return "로그인이 만료됐어요. 새로고침하거나 다시 로그인해 주세요.";
  if (err?.message === "realtime_unavailable") return "실시간 기능을 지금은 쓸 수 없어요.";
  return "실시간 서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.";
}
