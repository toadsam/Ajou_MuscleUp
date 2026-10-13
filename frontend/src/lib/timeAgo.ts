// "방금 · n분 전 · n시간 전 · n일 전 · 10월 3일".
// 서버 시각(LocalDateTime)은 시간대 표시가 없고 한국 시간이다(TimeConfig) → 해외 기기에서도 맞게 +09:00 으로 읽는다.
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(HAS_ZONE.test(iso) ? iso : `${iso}+09:00`).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
