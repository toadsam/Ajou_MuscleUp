// 득근득근 로고 — 25kg 원판을 정면에서 본 모양
export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 34 34" className="h-9 w-9" aria-hidden="true">
        <circle cx="17" cy="17" r="15" fill="#D9302A" stroke="#0E0E10" strokeWidth="3" />
        <circle cx="17" cy="17" r="9" fill="none" stroke="#0E0E10" strokeWidth="1.5" opacity="0.5" />
        <circle cx="17" cy="17" r="4.5" fill="#B8BBC0" stroke="#0E0E10" strokeWidth="2" />
      </svg>
      <span className="font-display text-2xl text-chalk md:text-[28px]">득근득근</span>
    </div>
  );
}
