export default function Home() {
  return (
    <section className="relative w-full h-screen flex items-center justify-center bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 text-white overflow-hidden">
      {/* 오버레이 (Glassmorphism 효과를 주기 위해) */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 text-center px-6 max-w-4xl">
        {/* 타이틀 */}
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 animate-fade-in-down">
          득근에서 <span className="text-green-300">함께</span> 성장하세요
        </h1>

        {/* 설명 */}
        <p className="text-lg md:text-2xl text-gray-200 leading-relaxed mb-10 animate-fade-in-up">
          최신 트렌드 운동 커뮤니티 🚀 <br />
          프로틴 공동구매 · 헬스장 후기 · 임원진 소개까지,  
          <span className="font-bold text-white"> 득근 하나로 해결!</span>
        </p>

        {/* 버튼 그룹 */}
        <div className="flex justify-center gap-6 flex-wrap">
          <a
            href="/protein"
            className="px-8 py-4 rounded-xl text-lg font-semibold bg-white text-gray-900 shadow-xl hover:scale-110 hover:shadow-2xl transform transition duration-300"
          >
            지금 시작하기!!!!
          </a>
          <a
            href="/reviews"
            className="px-8 py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-green-400 to-blue-500 text-white shadow-xl hover:scale-110 hover:shadow-2xl transform transition duration-300"
          >
            후기 보기
          </a>
        </div>
      </div>

      {/* 배경 원형 장식 (애니메이션) */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-ping"></div>
    </section>
  );
}
