export default function Home() {
  return (
    <section className="relative w-full h-screen flex items-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black overflow-hidden">
      {/* 좌측 비주얼 */}
      <div className="absolute left-10 w-1/2 h-full flex items-center justify-center">
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
          alt="Hero Visual"
          className="object-cover w-3/4 opacity-90 drop-shadow-2xl"
        />
      </div>

      {/* 텍스트 영역 */}
      <div className="ml-auto max-w-xl text-right pr-16 relative z-10">
        {/* ✅ 타이틀 */}
        <h1 className="text-5xl md:text-6xl font-heading font-extrabold leading-tight">
          득근에서{" "}
          <span className="bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            함께 성장
          </span>
          하세요
        </h1>

        {/* ✅ 설명 */}
        <p className="mt-6 text-lg md:text-xl font-body text-gray-300 leading-relaxed">
          운동 커뮤니티의 <span className="text-pink-400 font-semibold">새로운 기준 🚀</span>
          <br />
          <span className="text-white font-semibold">
            프로틴 공동구매 · 헬스장 후기 · 임원진 소개
          </span>
        </p>

        {/* ✅ 버튼 */}
        <div className="mt-10 flex justify-end gap-4">
          <a
            href="/protein"
            className="px-6 py-3 rounded-lg text-base font-semibold bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:scale-105 shadow-lg transition"
          >
            지금 시작하기
          </a>
          <a
            href="/reviews"
            className="px-6 py-3 rounded-lg text-base font-semibold border border-gray-400 text-white hover:bg-gray-800 transition"
          >
            후기 보기
          </a>
        </div>
      </div>
    </section>
  );
}
