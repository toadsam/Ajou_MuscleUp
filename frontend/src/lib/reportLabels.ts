// 신고(콘텐츠 · 사용자) 관련 값과 화면 이름. 서버 값(영문)은 그대로 보내고 화면에는 한국어만 보여 준다.

export type ReportTargetType = "BRAG_POST" | "BRAG_COMMENT" | "PROTEIN" | "USER" | "GYM_GUESTBOOK";
export type ReportReason = "SPAM" | "ABUSE" | "SEXUAL" | "ILLEGAL" | "FRAUD" | "PRIVACY" | "OTHER";
export type ReportStatus = "OPEN" | "ACTIONED" | "DISMISSED";

/** 고르는 순서 그대로 */
export const REPORT_REASONS: Array<[ReportReason, string]> = [
  ["SPAM", "스팸 · 광고"],
  ["ABUSE", "욕설 · 괴롭힘"],
  ["SEXUAL", "성적인 내용"],
  ["ILLEGAL", "불법 · 위험한 약물"],
  ["FRAUD", "사기 · 허위 공동구매"],
  ["PRIVACY", "개인정보 · 사진 무단 게시"],
  ["OTHER", "기타"],
];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = Object.fromEntries(REPORT_REASONS) as Record<ReportReason, string>;

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  BRAG_POST: "자랑방 글",
  BRAG_COMMENT: "자랑방 댓글",
  PROTEIN: "공동구매",
  USER: "사용자",
  GYM_GUESTBOOK: "헬스장 방명록",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "확인 전",
  ACTIONED: "조치함",
  DISMISSED: "문제없음",
};

export const REPORT_DETAIL_MAX = 500;
