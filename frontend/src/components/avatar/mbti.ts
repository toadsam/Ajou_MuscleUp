// MBTI 4글자 → 기질 두 글자(NT·NF·SJ·SP). 캐릭터 색은 이 기질을 따른다.
// "ISTJ" 처럼 S·J 가 떨어져 있어 includes("SJ") 로는 못 찾는다.
export type Temperament = "NT" | "NF" | "SJ" | "SP";

export function temperament(mbti?: string | null): Temperament | null {
  const v = (mbti ?? "").toUpperCase();
  if (!/^[EI][NS][TF][JP]$/.test(v)) return null;
  if (v[1] === "N") return v[2] === "T" ? "NT" : "NF";
  return v[3] === "J" ? "SJ" : "SP";
}
