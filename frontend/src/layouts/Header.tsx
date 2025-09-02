import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50 transition-all duration-300 ${
        isScrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
    >
      {/* 좌측 메뉴 */}
      <nav
        className={`flex space-x-8 font-medium transition-colors ${
          isScrolled ? "text-gray-800" : "text-white"
        }`}
      >
        <Link to="/protein" className="hover:text-pink-500 transition">프로틴 공구</Link>
        <Link to="/reviews" className="hover:text-pink-500 transition">헬스장 후기</Link>
        <Link to="/executives" className="hover:text-pink-500 transition">임원진 소개</Link>
      </nav>

      {/* 중앙 로고 */}
      <h1
        className={`text-2xl font-extrabold tracking-wide transition-colors ${
          isScrolled ? "text-gray-900" : "text-white"
        }`}
      >
        득근 <span className="text-pink-500">🏋️‍♂️</span>
      </h1>

      {/* 우측 액션 */}
      <div className="flex space-x-6 items-center">
        <Link
          to="/login"
          className={`transition ${
            isScrolled ? "text-gray-800 hover:text-pink-500" : "text-white hover:text-pink-400"
          }`}
        >
          로그인
        </Link>
        <button
          className={`px-4 py-2 rounded-lg transition ${
            isScrolled
              ? "bg-pink-500 text-white hover:bg-pink-600"
              : "bg-white text-gray-900 hover:bg-gray-100"
          }`}
        >
          회원가입
        </button>
      </div>
    </header>
  );
}
