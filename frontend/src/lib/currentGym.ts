// 지금 보고 있는 모임(짐). 소식 · 자랑방 · 반 신청이 이 값으로 범위를 정한다.
// localStorage "dg.currentGym" 에 slug 하나만 둔다. 값이 없으면 "광장"(앱 전체).
//
//   const [gymSlug, setGymSlug] = useCurrentGym();
//   const { gyms } = useMyGyms();
//
// 같은 탭의 다른 컴포넌트는 window 이벤트 "dg:current-gym" 으로, 다른 탭은 storage 이벤트로 맞춘다.

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GymSummary } from "../types/gym";

const STORAGE_KEY = "dg.currentGym";
const CHANGE_EVENT = "dg:current-gym";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getCurrentGym(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function setCurrentGym(slug: string | null) {
  const next = slug && slug.trim() ? slug.trim() : null;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장이 막혀 있어도 이번 화면에서는 바뀐 값으로 보이게 이벤트는 보낸다
  }
  try {
    window.dispatchEvent(new CustomEvent<string | null>(CHANGE_EVENT, { detail: next }));
  } catch {
    // ignore
  }
}

/** [현재 모임 slug(없으면 광장=null), 바꾸기] — 여러 컴포넌트가 같은 값을 본다 */
export function useCurrentGym(): [string | null, (slug: string | null) => void] {
  const [slug, setSlug] = useState<string | null>(getCurrentGym);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      setSlug(typeof detail === "string" ? detail : detail === null ? null : getCurrentGym());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) setSlug(getCurrentGym());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((next: string | null) => setCurrentGym(next), []);
  return [slug, update];
}

/** 로그인한 사람을 구분하는 값(계정이 바뀌면 내 모임 목록도 다시 받는다). 로그인 전이면 null */
function readUserKey(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: unknown; nickname?: unknown };
    if (typeof parsed.email === "string" && parsed.email) return parsed.email;
    if (typeof parsed.nickname === "string" && parsed.nickname) return parsed.nickname;
    return "user";
  } catch {
    return null;
  }
}

async function fetchMyGyms(): Promise<GymSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/gyms/mine`, { credentials: "include" });
    if (!res.ok) return [];
    const list = (await res.json()) as GymSummary[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 내가 속한 모임 목록. 로그인 전이거나 실패하면 빈 목록 */
export function useMyGyms(): { gyms: GymSummary[]; loading: boolean; loggedIn: boolean } {
  // 같은 탭에서 로그인하면 storage 이벤트가 오지 않는다 → 그릴 때마다 다시 읽는다(작은 문자열 하나라 가볍다)
  const userKey = readUserKey();
  const [, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setTick((n) => n + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "user") sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const query = useQuery({
    queryKey: ["gyms", "mine", userKey],
    queryFn: fetchMyGyms,
    enabled: Boolean(userKey),
    staleTime: 60_000,
  });

  return {
    gyms: userKey ? query.data ?? [] : [],
    loading: Boolean(userKey) && query.isLoading,
    loggedIn: Boolean(userKey),
  };
}

/** slug 에 맞는 모임 이름. 내 모임에 없으면 null */
export function findGymName(gyms: GymSummary[], slug: string | null): string | null {
  if (!slug) return null;
  return gyms.find((g) => g.slug === slug)?.name ?? null;
}
