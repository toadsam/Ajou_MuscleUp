import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import Logo from "./Logo";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<{ email: string; nickname: string; role: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          { to: "/brag", label: "자랑방" },
          { to: "/brag/write", label: "자랑 올리기" },
          { to: "/protein", label: "단백질 추천" },
          { to: "/reviews", label: "회원 리뷰" },
          { to: "/programs", label: "루틴/다이어트팁" },
        ],
      },
      {
        label: "멤버",
        links: [
          { to: "/executives", label: "운영진 소개" },
          { to: "/members", label: "멤버 소개" },
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
        links: [{ to: "/ai", label: "AI근력", highlight: true }],
      },
      {
        label: "내 정보",
        links: [{ to: "/mypage", label: "마이페이지" }],
      },
    ],
    []
  );

  const textColor = isScrolled || isMenuOpen ? "text-gray-800" : "text-white";

  const renderDropdown = (group: (typeof navGroups)[number]) => (
    <div
      className="absolute left-1/2 top-full z-40 mt-3 min-w-[260px] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-base text-white shadow-2xl backdrop-blur-lg"
      onMouseEnter={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setOpenDropdown(group.label);
      }}
      onMouseLeave={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setOpenDropdown(null), 120);
      }}
    >
      {group.links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className="block rounded-xl px-3 py-2 text-base font-semibold text-white/90 transition hover:bg-white/10 whitespace-nowrap"
          onClick={() => setOpenDropdown(null)}
        >
          {label}
        </Link>
      ))}
      {isAdmin && group.label === "커뮤니티" && (
        <Link
          to="/admin"
          className="mt-1 block rounded-xl px-3 py-2 font-semibold text-pink-300 hover:bg-white/10"
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
            aria-label="메뉴 열기"
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

        <nav className="ml-auto hidden items-center gap-3 lg:flex">
          {navGroups.map((group) => (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => {
                if (hideTimer.current) clearTimeout(hideTimer.current);
                setOpenDropdown(group.label);
              }}
              onMouseLeave={() => {
                if (hideTimer.current) clearTimeout(hideTimer.current);
                hideTimer.current = setTimeout(() => setOpenDropdown(null), 120);
              }}
            >
              <button
                className={`rounded-full px-5 py-2.5 text-base font-semibold transition ${
                  openDropdown === group.label
                    ? "bg-white/90 text-gray-800 shadow-lg"
                    : textColor === "text-white"
                    ? "text-white hover:bg-white/10 hover:shadow-[0_10px_30px_-15px_rgba(255,255,255,0.8)]"
                    : "text-gray-800 hover:bg-gray-100 hover:shadow"
                }`}
              >
                {group.label}
              </button>
              {openDropdown === group.label && renderDropdown(group)}
            </div>
          ))}

          {user ? (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${textColor}`}>{user.nickname} 님</span>
              <button
                onClick={handleLogout}
                className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              로그인
            </Link>
          )}
        </nav>

        {/* Mobile right controls */}
        <div className="flex items-center lg:hidden">
          {user ? (
            <button
              onClick={handleLogout}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              로그아웃
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              로그인
            </Link>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="bg-white px-6 py-4 text-gray-800 shadow-lg lg:hidden">
          {navGroups.map((group) => (
            <div key={group.label} className="py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{group.label}</p>
              <div className="mt-2 space-y-2">
                {group.links.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
