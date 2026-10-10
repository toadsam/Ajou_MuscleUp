export default function Footer() {
  const rawUpdatedAt = import.meta.env.VITE_APP_UPDATED_AT ?? "2026-04-02 10:05";
  const lastUpdated = rawUpdatedAt.includes(":") ? rawUpdatedAt : `${rawUpdatedAt} 00:00`;

  return (
    <footer className="relative border-t-[3px] border-black bg-steel-800 text-center text-steel-400">
      {/* 철판 띠 위쪽의 노랑-검정 안전 줄무늬 */}
      <div
        aria-hidden="true"
        className="h-2 border-b-2 border-black"
        style={{
          background:
            "repeating-linear-gradient(-45deg, var(--dg-yellow) 0 12px, var(--dg-ink) 12px 24px)",
        }}
      />
      <div className="flex flex-col items-center gap-2 px-5 py-7">
        <p className="text-sm">
          © 2026 <span className="font-display text-base text-plate-red">득근</span> | 운동을 사랑하는 사람들의 모임
        </p>
        <p className="text-xs text-steel-400">
          최근 업데이트 <span className="font-num text-sm tracking-wide text-chalk">{lastUpdated}</span>
        </p>
      </div>
    </footer>
  );
}
