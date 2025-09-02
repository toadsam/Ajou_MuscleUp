import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="bg-gray-900 text-white px-8 py-4 flex justify-between items-center shadow-md">
      <h1 className="text-2xl font-extrabold tracking-wide">🏋️‍♂️ 득근</h1>
      <nav className="space-x-6 font-semibold">
        <Link to="/" className="hover:text-green-400">홈</Link>
        <Link to="/protein" className="hover:text-green-400">프로틴 공구</Link>
        <Link to="/reviews" className="hover:text-green-400">헬스장 후기</Link>
        <Link to="/executives" className="hover:text-green-400">임원진 소개</Link>
      </nav>
    </header>
  );
}
