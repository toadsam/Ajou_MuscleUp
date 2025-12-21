import { useLocation, Link } from "react-router-dom";

export default function ProgramsApplySuccess() {
  const location = useLocation();
  const form = (location.state as any)?.form;

  return (
    <section className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white px-6 pb-20 pt-28 lg:px-10">
      <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 shadow-xl space-y-6">
        <p className="text-sm uppercase tracking-[0.2em] text-pink-200">Programs</p>
        <h1 className="text-3xl font-bold">신청이 접수되었습니다!</h1>
        <p className="text-gray-300">담당자가 확인 후 이메일로 안내드릴게요.</p>

        {form && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-2 text-sm text-gray-200">
            <div className="flex justify-between"><span className="text-gray-400">이름</span><span>{form.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">이메일</span><span>{form.email}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">트랙</span><span>{form.track}</span></div>
            <div><p className="text-gray-400">목표</p><p className="text-white mt-1 whitespace-pre-wrap">{form.goal}</p></div>
            <div><p className="text-gray-400">참여 의지</p><p className="text-white mt-1">{form.commitment}</p></div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/programs" className="px-4 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 font-semibold hover:opacity-90">
            프로그램으로 돌아가기
          </Link>
          <Link to="/" className="px-4 py-3 rounded-xl border border-white/20 hover:bg-white/10">
            홈으로
          </Link>
        </div>
      </div>
    </section>
  );
}
