import { Link, useLocation } from "react-router-dom";

type ForbiddenState = {
  reason?: string;
};

export default function Forbidden() {
  const location = useLocation();
  const state = (location.state || {}) as ForbiddenState;

  return (
    <section className="min-h-screen bg-slate-950 px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-300/30 bg-rose-500/10 p-8 text-center shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-200">403 Forbidden</p>
        <h1 className="mt-2 text-3xl font-extrabold">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm text-rose-100">
          {state.reason || "관리자 권한이 필요한 페이지입니다. 계정 권한을 확인해 주세요."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to="/" className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
            홈으로 이동
          </Link>
          <Link to="/login" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
            다시 로그인
          </Link>
        </div>
      </div>
    </section>
  );
}
