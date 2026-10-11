// 공동구매 후기 본문 = "제품 후기" + 빈 줄 + "공동구매 경험".
// 서버에는 한 칸(content)으로 저장되므로 예전 글과 같은 구분자(빈 줄)로 합치고 나눈다.

export const REVIEW_SEPARATOR = "\n\n";
export const REVIEW_MAX_LENGTH = 1000; // 서버 Review.content 길이

/** 저장된 본문을 두 칸으로 나눈다. 빈 줄이 없으면(예전 글) 모두 제품 후기 칸, 경험 칸은 비운다 */
export function splitReview(content: string): { product: string; share: string } {
  const parts = content.split(REVIEW_SEPARATOR);
  if (parts.length === 1) return { product: parts[0], share: "" };
  return { product: parts[0], share: parts.slice(1).join(REVIEW_SEPARATOR) };
}

/** 두 칸을 저장용 본문으로 합친다. 제품 후기 칸 안의 빈 줄은 한 줄로 줄여야 나눌 때 섞이지 않는다 */
export function joinReview(product: string, share: string): string {
  const p = product.trim().replace(/\n\s*\n+/g, "\n");
  const s = share.trim();
  return s ? `${p}${REVIEW_SEPARATOR}${s}` : p;
}
