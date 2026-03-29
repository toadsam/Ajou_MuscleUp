export default function Footer() {
  const rawUpdatedAt = import.meta.env.VITE_APP_UPDATED_AT ?? "2026-03-29 16:55";
  const lastUpdated = rawUpdatedAt.includes(":") ? rawUpdatedAt : `${rawUpdatedAt} 00:00`;

  return (
    <footer className="bg-black text-gray-500 text-center py-8">
      <p className="text-sm">
        © 2026 <span className="text-pink-500 font-semibold">득근</span> | 운동을 사랑하는 사람들의 모임
      </p>
      <p className="mt-2 text-xs text-gray-400">최근 업데이트: {lastUpdated}</p>
    </footer>
  );
}
