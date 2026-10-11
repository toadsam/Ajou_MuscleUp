import { Link, useLocation } from "react-router-dom";

// 없는 주소로 들어왔을 때 보여 주는 화면. Forbidden 과 같은 철판 카드 모양.
export default function NotFound() {
  const location = useLocation();

  return (
    <section className="min-h-screen px-6 pb-20 pt-28 text-chalk lg:px-10">
      <div className="dg-steel dg-rise relative mx-auto max-w-2xl overflow-hidden p-8 text-center">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-plate-yellow" />
        {/* 바닥에 떨어진 원판 하나 */}
        <div className="dg-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-black bg-plate-yellow text-black shadow-md">
          <span aria-hidden="true" className="h-4 w-4 rounded-full border-[3px] border-black bg-steel-800" />
        </div>
        <p className="mt-4 font-num text-lg tracking-wide text-plate-yellow">404</p>
        <h1 className="mt-1 text-3xl">페이지를 찾을 수 없어요</h1>
        <p className="mt-3 break-keep text-sm text-steel-300">
          주소가 바뀌었거나 지워진 페이지예요. 아래에서 다시 시작해 주세요.
        </p>
        <p className="mt-2 break-all font-num text-xs text-steel-500">{location.pathname}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="dg-btn dg-btn-primary px-4 py-2 text-sm">
            홈으로 가기
          </Link>
          <Link to="/attendance" className="dg-btn dg-btn-steel px-4 py-2 text-sm">
            출석하러 가기
          </Link>
          <Link to="/lounge" className="dg-btn dg-btn-steel px-4 py-2 text-sm">
            라운지
          </Link>
        </div>
      </div>
    </section>
  );
}
