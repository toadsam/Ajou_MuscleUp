import { Link, useLocation } from "react-router-dom";

type ForbiddenState = {
  reason?: string;
};

export default function Forbidden() {
  const location = useLocation();
  const state = (location.state || {}) as ForbiddenState;

  return (
    <section className="min-h-screen px-6 pb-20 pt-28 text-chalk lg:px-10">
      <div className="dg-steel dg-rise relative mx-auto max-w-2xl overflow-hidden p-8 text-center">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-plate-red" />
        {/* 잠긴 원판 자물쇠 */}
        <div className="dg-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-black bg-plate-red text-white shadow-md">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <p className="mt-4 font-num text-lg tracking-wide text-plate-red">403</p>
        <h1 className="mt-1 text-3xl">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm text-steel-300">
          {state.reason || "관리자 권한이 필요한 페이지입니다. 계정 권한을 확인해 주세요."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/" className="dg-btn dg-btn-steel px-4 py-2 text-sm">
            홈으로 이동
          </Link>
          <Link to="/login" className="dg-btn dg-btn-primary px-4 py-2 text-sm">
            다시 로그인
          </Link>
        </div>
      </div>
    </section>
  );
}
