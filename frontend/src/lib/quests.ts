// 오늘 할 일 · 활동 레벨(PR E) — 서버 DailyQuestService.Today 와 같은 모양
export type QuestItem = { id: "attendance" | "diet" | "cheer"; label: string; done: boolean; points: number };

export type ActivityLevel = { level: number; totalPoints: number; pointsInLevel: number; pointsForNext: number };

export type TodayQuests = {
  date: string;
  items: QuestItem[];
  allDone: boolean;
  allRewarded: boolean;
  allPoints: number;
  /** goalG 가 없으면 단백질 목표 없음 */
  protein: { goalG: number | null; eatenG: number; done: boolean; rewarded: boolean; points: number };
  activity: ActivityLevel;
};

export const QUESTS_PATH = "/api/quests/today";

/** 할 일마다 가는 곳과 짧은 설명 */
export const QUEST_LINKS: Record<QuestItem["id"], { to: string; desc: string; doneLabel: string }> = {
  attendance: { to: "/attendance", desc: "운동이든 휴식이든 오늘 기록", doneLabel: "출석 완료" },
  diet: { to: "/diet", desc: "한 끼만 적어도 돼요", doneLabel: "식단 기록 완료" },
  cheer: { to: "/brag", desc: "자랑방 좋아요 · 댓글", doneLabel: "응원 완료" },
};
