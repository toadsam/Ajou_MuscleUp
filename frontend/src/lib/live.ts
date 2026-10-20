// "지금 운동 · 러닝 중" — 운동 세션 · 러닝 화면이 1분마다 서버에 알린다(PUT /api/live).
// 서버는 3분 동안 기억하고, 라운지 광장 "운동 구역"에 그 사람 캐릭터가 지금 종목 동작을 하는 모습으로 보인다.
// "라운지에 보이기"를 끄면 알리지 않는다(이 기기에만 저장).
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { CharacterTier, GrowthParams } from "../components/avatar/types";
import type { LiftCategory } from "./lifts";

export type LiveActivity = "WORKOUT" | "RUN";

export type LiveItem = {
  nickname: string;
  mine: boolean;
  activity: LiveActivity;
  exercise: string | null;
  label: string | null;
  category: LiftCategory | null;
  bodyweight: boolean;
  avatarSeed: string;
  tier: CharacterTier;
  evolutionStage: number;
  gender: "MALE" | "FEMALE" | null;
  growthParams: GrowthParams | null;
  tank: string | null;
  isPumped: boolean;
  since: number;
  /** 몸 단계 0~5(서버 BodyStage) */
  bodyStage?: number;
};

const BEAT_MS = 60_000;
const VISIBLE_KEY = "dg.live.visible";

const readVisible = () => {
  try {
    return window.localStorage.getItem(VISIBLE_KEY) !== "0";
  } catch {
    return true;
  }
};

/** 라운지에 보이기(기본 켬) */
export function useLiveVisible() {
  const [visible, setVisible] = useState(readVisible);
  const toggle = useCallback(() => {
    setVisible((prev) => {
      try {
        window.localStorage.setItem(VISIBLE_KEY, prev ? "0" : "1");
      } catch {
        // 저장 못 해도 이번 화면에서는 바뀐다
      }
      return !prev;
    });
  }, []);
  return [visible, toggle] as const;
}

export const endLive = () => api.delete("/api/live").catch(() => undefined);

/** 켜져 있는 동안 1분마다 알리고, 꺼지거나 화면을 떠나면 끝났다고 알린다. 종목이 바뀌면 바로 다시 알린다 */
export function useLiveHeartbeat(active: boolean, activity: LiveActivity, exercise?: string | null) {
  useEffect(() => {
    if (!active) return;
    const beat = () => {
      if (document.visibilityState === "hidden") return; // 화면이 꺼져 있으면 굳이(3분 뒤 빠진다)
      void api.put("/api/live", { activity, exercise: exercise ?? null }).catch(() => undefined);
    };
    beat();
    const t = window.setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [active, activity, exercise]);

  // 꺼질 때(끝내기 · 그만두기 · 보이기 끔 · 화면 떠남) 한 번
  useEffect(() => {
    if (!active) return;
    return () => {
      void endLive();
    };
  }, [active]);
}
