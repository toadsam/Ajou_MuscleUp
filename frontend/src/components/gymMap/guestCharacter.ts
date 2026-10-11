// 로그인 전 "지도 체험"에서 만든 임시 캐릭터.
// 이 브라우저에만 남는다(서버에 안 보냄). 가입 뒤 마이페이지 스탯 입력칸을 이 값으로 미리 채우고,
// 스탯을 저장하면 지운다. 저장소가 막힌 환경(사생활 보호 창 등)에서는 조용히 없는 것으로 친다.
export type GuestCharacter = { gender: "MALE" | "FEMALE"; mbti: string };

const KEY = "dg.guestCharacter";

export function loadGuestCharacter(): GuestCharacter | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<GuestCharacter>;
    if ((v.gender !== "MALE" && v.gender !== "FEMALE") || !/^[EI][NS][TF][JP]$/.test(v.mbti ?? "")) return null;
    return { gender: v.gender, mbti: v.mbti as string };
  } catch {
    return null;
  }
}

export function saveGuestCharacter(c: GuestCharacter) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* 저장 못 해도 이번 방문 동안은 화면 상태로 유지된다 */
  }
}

export function clearGuestCharacter() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
