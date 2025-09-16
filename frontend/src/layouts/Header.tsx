import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<{ email: string; nickname: string; role: string } | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);

    // ✅ localStorage에서 유저 정보 불러오기
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/"; // 메인으로 이동
  };

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
        <Link to="/protein" className="hover:text-pink-500 transition">
          프로틴 공구
        </Link>
        <Link to="/reviews" className="hover:text-pink-500 transition">
          헬스장 후기
        </Link>
        <Link to="/executives" className="hover:text-pink-500 transition">
          임원진 소개
        </Link>
        <Link to="/ai" className="hover:text-pink-500 transition font-semibold">
          AI득근
        </Link>
      </nav>

      {/* 중앙 로고 */}
      <Link to="/">
        <Logo isScrolled={isScrolled} />
      </Link>

      {/* 우측 액션 */}
      <div className="flex space-x-6 items-center">
        {user ? (
          // ✅ 로그인 된 경우 → 닉네임 표시 + 로그아웃 버튼
          <>
            <span
              className={`font-semibold ${
                isScrolled ? "text-gray-800" : "text-white"
              }`}
            >
              {user.nickname} 님 환영합니다 🎉
            </span>
            <button
              onClick={handleLogout}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isScrolled
                  ? "bg-gray-800 text-white hover:bg-gray-900"
                  : "bg-white text-gray-900 hover:bg-gray-100"
              }`}
            >
              로그아웃
            </button>
          </>
        ) : (
          // ✅ 로그인 안 된 경우 → 로그인 / 회원가입 버튼
          <>
            <Link
              to="/login"
              className={`transition ${
                isScrolled
                  ? "text-gray-800 hover:text-pink-500"
                  : "text-white hover:text-pink-400"
              }`}
            >
              로그인
            </Link>
            <button
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isScrolled
                  ? "bg-pink-500 text-white hover:bg-pink-600"
                  : "bg-white text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Link to="/register">회원가입</Link>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
