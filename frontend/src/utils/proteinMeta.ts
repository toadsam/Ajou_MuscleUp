// 공동구매(단백질) 모집글에서 화면에 보여 줄 값을 "실제 데이터로만" 만든다.
// 예전에는 설명 글의 낱말("보관", "직접")로 분배 방식을 짐작하고, 평점 · 금액으로 추천 문구를 지어냈다.

export type ProteinLike = {
  description?: string | null;
  distributionMethod?: string | null;
  deadline?: string | null;
  daysLeft?: number | null;
  closed?: boolean;
};

/** 분배 방식으로 고를 수 있는 값(서버 ProteinServiceImpl.DISTRIBUTION_METHODS 와 같다) */
export const DISTRIBUTION_METHODS = ["직접 만나서", "헬스장 보관함", "택배", "기타"] as const;

/** 설명 글에서 "키: 값" 줄을 찾는다. 글쓰기 화면이 직접 써 넣은 줄만 읽는다 */
export const findMetaLine = (description?: string | null, key?: string) => {
  if (!description || !key) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}\\s*[:：]\\s*(.+)$`, "im");
  const match = description.match(regex);
  return match?.[1]?.trim() || null;
};

/** 분배 방식: 새 글은 distributionMethod, 예전 글은 글쓰기 화면이 남긴 "분배 방식: …" 줄. 없으면 null */
export const distributionOf = (p: ProteinLike): string | null => {
  if (p.distributionMethod) return p.distributionMethod;
  const line = findMetaLine(p.description, "분배 방식");
  if (!line) return null;
  if (line === "직접 만남") return "직접 만나서"; // 예전 글쓰기 화면의 이름
  return line;
};

/** 마감됐는지: 서버가 계산한 closed(마감일이 지남) */
export const isClosed = (p: ProteinLike) => !!p.closed;

/** 남은 기간 문구. 마감일이 없는 예전 글은 지어내지 않고 "마감일 미정" */
export const remainingLabel = (p: ProteinLike) => {
  if (typeof p.daysLeft !== "number") return "마감일 미정";
  if (p.daysLeft < 0) return "마감";
  if (p.daysLeft === 0) return "오늘 마감";
  return `${p.daysLeft}일 남음`;
};

/** 마감일 표시(예: 10월 18일) */
export const deadlineLabel = (p: ProteinLike) => {
  if (!p.deadline) return null;
  const d = new Date(`${p.deadline}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
};
