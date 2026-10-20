// "이 기기에서 지난번 본 값" 기억 — 성장 순간 창(몸이 커졌어요 · 티어가 올랐어요)이 같은 것을 두 번 띄우지 않게.
// localStorage { [아바타 시드]: 값 }. 저장 못 하는 브라우저(사생활 보호 창)면 다음에 또 보일 뿐이다.

export const readSeen = (key: string): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
};

export const rememberSeen = (key: string, seedKey: string, value: number) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...readSeen(key), [seedKey]: value }));
  } catch {
    // 저장 못 함 — 다음에 한 번 더 보인다
  }
};

/** 지난번 본 값보다 올랐으면 그 값(창을 띄운다), 아니면 null */
export const risenFrom = (key: string, seedKey: string, value: number): number | null => {
  const prev = readSeen(key)[seedKey];
  return typeof prev === "number" && value > prev ? prev : null;
};
