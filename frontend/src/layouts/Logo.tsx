export default function Logo({ isScrolled }: { isScrolled: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      {/* 아이콘 (덤벨 모양) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        className="w-10 h-10"
      >
        <rect x="14" y="22" width="6" height="20" fill="#ec4899" />
        <rect x="44" y="22" width="6" height="20" fill="#6366f1" />
        <rect x="20" y="28" width="24" height="8" fill="#a855f7" />
      </svg>

      {/* 텍스트 로고 */}
      <span
        className={`font-extrabold tracking-widest text-2xl md:text-3xl ${
          isScrolled ? "text-gray-900" : "text-white"
        }`}
      >
        득근
      </span>
    </div>
  );
}
