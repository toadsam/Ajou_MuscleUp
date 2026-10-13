import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";
import { clearSupportChat } from "../lib/supportChatStorage";
import { setCurrentGym, useCurrentGym, useMyGyms } from "../lib/currentGym";

// 모임 고르기 select 의 특별한 값(모임 slug 와 겹치지 않게 slug 규칙에 없는 문자를 쓴다)
const FIND_GYMS_VALUE = "__find";

interface UserState {
  email: string;
  nickname: string;
  role: string;
  accessToken?: string;
}

interface NavLinkItem {
  to: string;
  label: string;
}

interface NavGroup {
  label: string;
  links: NavLinkItem[];
  /** 휴대폰 메뉴에서 처음에 접어 둔다(지금 보는 화면이 안에 있으면 펼침) */
  folded?: boolean;
}

function readLocalUser(): UserState | null {
  try {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return null;
    return JSON.parse(savedUser) as UserState;
  } catch {
    return null;
  }
}

function hasLocalSession(user: UserState | null): boolean {
  if (!user) return false;
  return Boolean(
    (typeof user.accessToken === "string" && user.accessToken.length > 0) ||
      (typeof user.email === "string" && user.email.length > 0),
  );
}

function buildAuthHeaders(user: UserState | null): HeadersInit | undefined {
  if (!user?.accessToken) return undefined;
  return { Authorization: `Bearer ${user.accessToken}` };
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<UserState | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  // 휴대폰 메뉴에서 펼친 접힌 묶음(folded)
  const [unfolded, setUnfolded] = useState<string[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "ROLE_ADMIN";
  const API_BASE = import.meta.env.VITE_API_BASE ?? "";

  // 지금 보는 곳(광장 또는 내 모임). 소식 · 자랑방 · 반 신청이 이 값으로 범위를 정한다
  const { gyms: myGyms } = useMyGyms();
  const [currentGymSlug, setCurrentGymSlug] = useCurrentGym();
  const showGymSwitcher = Boolean(user) && myGyms.length > 0;
  const currentGymKnown = !currentGymSlug || myGyms.some((g) => g.slug === currentGymSlug);

  const renderGymSwitcher = (id: string, className: string) => (
    <select
      id={id}
      aria-label="지금 보는 모임"
      value={currentGymSlug ?? ""}
      onChange={(e) => {
        const value = e.target.value;
        if (value === FIND_GYMS_VALUE) {
          setIsMenuOpen(false);
          navigate("/gyms");
          return;
        }
        setCurrentGymSlug(value || null);
      }}
      className={`rounded-md border-2 border-black bg-steel-700 font-semibold text-chalk shadow-sm hover:bg-steel-600 focus:outline-none focus-visible:border-plate-yellow ${className}`}
    >
      <option value="">광장 (전체)</option>
      {myGyms.map((g) => (
        <option key={g.slug} value={g.slug}>
          {g.name}
        </option>
      ))}
      {!currentGymKnown && currentGymSlug && <option value={currentGymSlug}>둘러보는 모임</option>}
      <option value={FIND_GYMS_VALUE}>모임 찾기</option>
    </select>
  );

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);

    const syncAuthState = async () => {
      const localUser = readLocalUser();
      setUser(localUser);
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
          cache: "no-store",
          headers: buildAuthHeaders(localUser),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            if (hasLocalSession(localUser)) {
              // Safari may fail cookie reads intermittently even with a valid
              // local access token. Keep local session until a real API auth
              // failure path clears it.
              return;
            }
            localStorage.removeItem("user");
            setUser(null);
          }
          return;
        }
        const me = await res.json();
        const nextUser: UserState = {
          email: me?.email ?? "",
          nickname: me?.nickname ?? localUser?.nickname ?? "회원",
          role: me?.role ?? "",
          accessToken: localUser?.accessToken,
        };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
      } catch {
        // Keep current UI state when network is unstable.
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "user") return;
      setUser(readLocalUser());
    };

    const onFocus = () => {
      void syncAuthState();
    };

    void syncAuthState();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("user");
      clearSupportChat(); // 같은 기기에서 다음 사람이 이전 계정의 문의 기록을 보지 않게
      setCurrentGym(null); // 다음 사람이 이전 계정의 모임을 보고 있지 않게 광장으로
      setUser(null);
      window.location.href = "/";
    }
  };

  const navGroups = useMemo<NavGroup[]>(
    () => [
      // 매일 쓰는 것(홈 바로 가기와 같은 순서)을 맨 위에. 동아리 소개 · 소식은 한 묶음으로 모아 휴대폰에서 접어 둔다.
      // (처음 온 사람 점검 #4 — docs/fixes/2026-10-13-first-run-ux.md) 글쓰기 같은 행동 버튼은 각 화면 안에 있다.
      {
        label: "오늘 운동",
        links: [
          { to: "/attendance", label: "출석 체크" },
          { to: "/diet", label: "식단 기록" },
          { to: "/workout", label: "운동 기록" },
          { to: "/run", label: "러닝" },
        ],
      },
      {
        label: "라운지",
        links: [
          { to: "/lounge", label: "라운지" },
          { to: "/collection", label: "도감 · 보상 상자" },
          { to: "/rankings", label: "랭킹" },
        ],
      },
      {
        label: "커뮤니티",
        links: [
          { to: "/brag", label: "자랑방" },
          { to: "/crew", label: "운동 모임" },
          { to: "/gyms", label: "모임 찾기" },
          { to: "/friends", label: "친구/채팅" },
          { to: "/protein", label: "단백질 공동구매" },
          { to: "/reviews", label: "단백질 리뷰" },
        ],
      },
      {
        label: "AI",
        links: [
          { to: "/ai", label: "AI 플래너" },
          { to: "/ai/inbody", label: "인바디 분석" },
        ],
      },
      {
        label: "동아리 · 소식",
        folded: true,
        links: [
          { to: "/events", label: "이벤트" },
          { to: "/programs", label: "반 추천/신청" },
          { to: "/about", label: "득근득근 소개" },
          { to: "/executives", label: "운영진 소개" },
          { to: "/members", label: "멤버 소개" },
          { to: "/gallery", label: "갤러리" },
        ],
      },
      {
        label: "내 정보",
        links: [{ to: "/mypage", label: "마이페이지" }],
      },
    ],
    []
  );

  const isActiveGroup = (group: NavGroup) =>
    group.links.some((link) => {
      if (link.to === "/") {
        return location.pathname === "/";
      }
      return location.pathname.startsWith(link.to);
    });

  const renderDropdown = (group: NavGroup) => (
    <div
      className="absolute left-1/2 top-full z-40 mt-2 min-w-[240px] -translate-x-1/2 rounded-lg border-[3px] border-black bg-steel-800 p-2 text-base text-chalk shadow-xl"
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
          className={`block whitespace-nowrap rounded px-3 py-2.5 text-[15px] font-semibold transition hover:bg-steel-700 ${
            location.pathname.startsWith(to) ? "bg-steel-700 text-white" : "text-steel-200"
          }`}
          onClick={() => setOpenDropdown(null)}
        >
          {label}
        </Link>
      ))}
      {isAdmin && group.label === "커뮤니티" && (
        <Link
          to="/admin"
          className="mt-1 block rounded border-t-2 border-black px-3 py-2.5 text-[15px] font-semibold text-plate-yellow hover:bg-steel-700"
          onClick={() => setOpenDropdown(null)}
        >
          관리자
        </Link>
      )}
    </div>
  );

  const actionButton =
    "dg-btn min-h-[42px] px-4 text-sm";

  return (
    <header
      className={`fixed left-0 top-0 z-50 w-full border-b-[3px] border-black bg-[#222327] text-chalk transition-shadow ${
        isScrolled || isMenuOpen ? "shadow-lg" : ""
      }`}
    >
      <div className="relative mx-auto flex w-full max-w-6xl items-center px-4 py-2.5 sm:px-6 lg:gap-8 lg:px-10">
        <div className="flex w-[104px] items-center lg:w-auto lg:flex-none lg:gap-4">
          <button
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-md border-[3px] border-black bg-steel-700 text-chalk shadow-md lg:hidden"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
          >
            <span className="h-0.5 w-5 bg-current" />
            <span className="h-0.5 w-5 bg-current" />
            <span className="h-0.5 w-5 bg-current" />
          </button>
        </div>

        <Link
          to="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center lg:static lg:ml-0 lg:translate-x-0"
        >
          <Logo />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="주 메뉴">
          {navGroups.map((group) => {
            const active = isActiveGroup(group);
            const open = openDropdown === group.label;
            return (
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
                  className={`flex min-h-[44px] items-center border-b-4 px-3.5 text-[15px] font-semibold transition ${
                    active
                      ? "border-plate-red text-white"
                      : open
                        ? "border-steel-600 text-white"
                        : "border-transparent text-steel-300 hover:border-steel-600 hover:text-white"
                  }`}
                  aria-expanded={open}
                  onClick={() => setOpenDropdown(open ? null : group.label)}
                >
                  {group.label}
                </button>
                {open && renderDropdown(group)}
              </div>
            );
          })}

          {user ? (
            <div className="ml-3 flex items-center gap-3">
              {showGymSwitcher && renderGymSwitcher("gym-switcher-desktop", "min-h-[42px] max-w-[10rem] truncate px-2 text-sm")}
              <span className={`text-sm font-semibold text-steel-300 ${showGymSwitcher ? "hidden xl:inline" : ""}`}>{user.nickname}님</span>
              <button onClick={handleLogout} className={`${actionButton} dg-btn-steel`}>
                로그아웃
              </button>
            </div>
          ) : (
            <Link to="/login" className={`${actionButton} dg-btn-primary ml-3`}>
              로그인
            </Link>
          )}
        </nav>

        <div className="ml-auto flex w-[104px] items-center justify-end lg:hidden lg:w-auto">
          {user ? (
            <button onClick={handleLogout} className={`${actionButton} dg-btn-steel`}>
              로그아웃
            </button>
          ) : (
            <Link to="/login" className={`${actionButton} dg-btn-primary`}>
              로그인
            </Link>
          )}
        </div>
      </div>

      {isMenuOpen && (
        <div className="max-h-[calc(100dvh-70px)] overflow-y-auto overscroll-y-contain border-t-[3px] border-black bg-steel-800 px-5 py-3 pb-24 text-chalk lg:hidden">
          {showGymSwitcher && (
            <div className="border-b-2 border-black/60 py-3">
              <label htmlFor="gym-switcher-mobile" className="text-sm font-semibold text-steel-400">
                지금 보는 곳
              </label>
              {renderGymSwitcher("gym-switcher-mobile", "mt-2 min-h-[44px] w-full px-3 text-[15px]")}
            </div>
          )}
          {navGroups.map((group) => {
            const shut = group.folded && !unfolded.includes(group.label) && !isActiveGroup(group);
            return (
            <div key={group.label} className="border-b-2 border-black/60 py-3 last:border-b-0">
              {group.folded ? (
                <button
                  type="button"
                  aria-expanded={!shut}
                  onClick={() => setUnfolded((u) => (shut ? [...u, group.label] : u.filter((l) => l !== group.label)))}
                  className="flex min-h-[36px] w-full items-center justify-between text-sm font-semibold text-steel-400"
                >
                  <span>{group.label}</span>
                  <span aria-hidden="true">{shut ? "펼치기 ▾" : "접기 ▴"}</span>
                </button>
              ) : (
                <p className="font-num text-sm tracking-wide text-steel-400">{group.label}</p>
              )}
              {!shut && (
              <div className="mt-2 space-y-1">
                {group.links.map(({ to, label }) => {
                  const active = location.pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex min-h-[44px] items-center rounded border-l-4 px-3 text-[15px] font-semibold ${
                        active ? "border-plate-red bg-steel-700 text-white" : "border-transparent text-steel-200 hover:bg-steel-700"
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  );
                })}
                {isAdmin && group.label === "커뮤니티" && (
                  <Link
                    to="/admin"
                    className="flex min-h-[44px] items-center rounded border-l-4 border-transparent px-3 text-[15px] font-semibold text-plate-yellow hover:bg-steel-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    관리자
                  </Link>
                )}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </header>
  );
}
