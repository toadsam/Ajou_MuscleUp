import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Logo from "./Logo";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<{ email: string; nickname: string; role: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "ROLE_ADMIN";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);

    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/";
  };

  const navGroups = useMemo(
    () => [
      {
        label: "커뮤니티",
        links: [
          { to: "/protein", label: "보충제 모음" },
          { to: "/reviews", label: "회원 후기" },
        ],
      },
      {
        label: "멤버",
        links: [
          { to: "/executives", label: "임원진 소개" },
          { to: "/members", label: "부원 소개" },
        ],
      },
      {
        label: "미디어",
        links: [
          { to: "/gallery", label: "갤러리" },
          { to: "/about", label: "소개" },
        ],
      },
      {
        label: "AI",
        links: [{ to: "/ai", label: "AI독근", highlight: true }],
      },
    ],
    []
  );

  const textColor = isScrolled || isMenuOpen ? "text-gray-800" : "text-white";

  const renderDropdown = (group: (typeof navGroups)[number]) => (
    <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-2xl border border-black/5 bg-white p-4 text-base text-gray-700 shadow-xl">
      {group.links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className="block rounded-xl px-3 py-2 transition hover:bg-gray-100"
          onClick={() => setOpenDropdown(null)}
        >
          {label}
        </Link>
      ))}
      {isAdmin && group.label === "커뮤니티" && (
        <Link
          to="/admin"
          className="mt-1 block rounded-xl px-3 py-2 font-semibold text-pink-500 hover:bg-pink-50"
          onClick={() => setOpenDropdown(null)}
        >
          관리자
        </Link>
      )}
    </div>
  );

  return (
    <header
      className={`fixed top-0 left-0 z-50 w-full transition-colors duration-300 ${
        isScrolled || isMenuOpen ? "bg-white/90 shadow-md backdrop-blur" : "bg-transparent"
      }`}
    >
      <div className="relative mx-auto flex w-full max-w-6xl items-center px-6 py-3 lg:gap-8 lg:px-10">
        <div className="flex flex-1 items-center lg:flex-none lg:gap-4">
          <button
            className={`flex flex-col gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition lg:hidden ${
              isScrolled || isMenuOpen ? "border-gray-200 text-gray-800" : "border-white/60 text-white"
            }`}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="모바일 메뉴 열기"
          >
            <span className="h-0.5 w-6 bg-current" />
            <span className="h-0.5 w-6 bg-current" />
            <span className="h-0.5 w-6 bg-current" />
          </button>
        </div>

        <Link
          to="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center lg:static lg:ml-0 lg:translate-x-0"
        >
          <Logo isScrolled={isScrolled || isMenuOpen} />
        </Link>

        <div className="ml-auto hidden items-center gap-6 lg:flex">
          <nav className={`flex items-center gap-6 text-base font-semibold ${textColor}`}>
            {navGroups.map((group) => (
              <div key={group.label} className="relative">
                <button
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition ${textColor} hover:bg-white/10 ${
                    openDropdown === group.label ? "bg-white/20" : ""
                  }`}
                  onClick={() => setOpenDropdown((prev) => (prev === group.label ? null : group.label))}
                  onBlur={() => setTimeout(() => setOpenDropdown(null), 150)}
                >
                  {group.label}
                  <span className="text-xs">▾</span>
                </button>
                {openDropdown === group.label && renderDropdown(group)}
              </div>
            ))}
          </nav>

          {user ? (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${textColor}`}>{user.nickname} 님</span>
              <button
                onClick={handleLogout}
                className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className={`text-sm transition hover:text-pink-500 ${textColor}`}>
                로그인
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-600"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 shadow-lg lg:hidden">
          <nav className="flex flex-col gap-4 text-base font-medium text-gray-800">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">{group.label}</p>
                {group.links.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className="block rounded-lg px-3 py-2 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-lg px-3 py-2 font-semibold text-pink-500 hover:bg-pink-50"
                onClick={() => setIsMenuOpen(false)}
              >
                관리자
              </Link>
            )}
            <div className="mt-3 flex flex-col gap-3">
              {user ? (
                <>
                  <span className="text-sm font-semibold text-gray-600">{user.nickname} 님</span>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-700 transition hover:text-pink-500"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    로그인
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-lg bg-pink-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-pink-600"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
