// 자랑방 "이 기기에서 숨김" 목록.
// 서버에 저장하지 않는 개인 설정이라 이 브라우저에서만 적용된다(다른 기기 · 다른 사람에게는 그대로 보인다).
// 저장 키는 예전 "차단" 기능과 같게 두어, 이미 숨겨 둔 작성자가 그대로 유지된다.

const STORAGE_KEY = "brag_blocked_authors";

type AuthorLike = { authorEmail?: string | null; authorId?: number | null };

/** 작성자를 가리키는 값: 이메일(지금 응답에 있음), 없으면 id */
export const authorKey = (post: AuthorLike): string | null =>
  post.authorEmail ? post.authorEmail : typeof post.authorId === "number" ? `id:${post.authorId}` : null;

export function getHiddenAuthors(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function setHiddenAuthors(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이번 화면에서만 적용
  }
}

/** 숨김 ↔ 해제. 바뀐 목록을 돌려준다 */
export function toggleHiddenAuthor(key: string): string[] {
  const now = getHiddenAuthors();
  const next = now.includes(key) ? now.filter((v) => v !== key) : [...now, key];
  setHiddenAuthors(next);
  return next;
}
