import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="absolute top-0 left-0 w-full flex justify-between items-center px-10 py-6 z-50">
      {/* 로고 */}
      <h1 className="text-2xl font-extrabold text-pink-500">득근</h1>

      {/* 네비 */}
      <nav className="flex space-x-8 text-white font-medium">
        <Link to="/" className="hover:text-pink-400 transition">홈</Link>
        <Link to="/protein" className="hover:text-pink-400 transition">프로틴 공구</Link>
        <Link to="/reviews" className="hover:text-pink-400 transition">헬스장 후기</Link>
        <Link to="/executives" className="hover:text-pink-400 transition">임원진 소개</Link>
      </nav>
    </header>
  );
}
