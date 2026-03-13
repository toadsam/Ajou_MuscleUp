import { Link, useLocation } from "react-router-dom";

interface SuccessFormState {
  name: string;
  email: string;
  track: string;
  personalGoal?: string;
  recommendedTrack?: string | null;
  recommendationReasons?: string[];
  readiness?: string | null;
  coachingPoint?: string | null;
}

export default function ProgramsApplySuccess() {
  const location = useLocation();
  const form = (location.state as { form?: SuccessFormState } | null)?.form;

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-45px_rgba(68,64,60,0.35)] backdrop-blur sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">Programs</p>
          <h1 className="mt-3 text-4xl font-black text-white">반 신청이 접수되었습니다.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-300">
            설문 결과와 신청 정보를 기준으로 운영 흐름을 확인한 뒤 연결됩니다. 지금 선택한 반과 추천 근거를 아래에서 다시 확인할 수 있습니다.
          </p>

          {form ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
              <div className="rounded-[1.75rem] bg-slate-900/80 p-6 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">신청 정보</p>
                <div className="mt-5 space-y-4 text-sm leading-6 text-gray-200">
                  <div>
                    <p className="text-gray-400">이름</p>
                    <p className="font-semibold text-white">{form.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">이메일</p>
                    <p className="font-semibold text-white">{form.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">최종 신청 반</p>
                    <p className="font-semibold text-white">{form.track}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">한 줄 목표</p>
                    <p className="font-semibold text-white whitespace-pre-wrap">{form.personalGoal || "입력 없음"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">추천 결과</p>
                <div className="mt-5 space-y-4 text-sm leading-6 text-gray-300">
                  <div>
                    <p className="text-gray-400">설문 추천 반</p>
                    <p className="font-semibold text-white">{form.recommendedTrack || "직접 선택"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">현재 단계</p>
                    <p className="font-semibold text-white">{form.readiness || "직접 선택"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">추천 이유</p>
                    <div className="mt-2 space-y-2">
                      {(form.recommendationReasons && form.recommendationReasons.length > 0
                        ? form.recommendationReasons
                        : ["설문 없이 원하는 반을 직접 선택했습니다."]
                      ).map((reason) => (
                        <div key={reason} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400">운영 메모</p>
                    <p className="font-semibold text-white">{form.coachingPoint || "선택한 반 기준으로 운영 흐름이 안내됩니다."}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-[1.75rem] border border-dashed border-white/20 bg-white/5 p-6 text-sm leading-6 text-gray-300">
              신청 요약 정보를 찾지 못했습니다. 다시 신청 페이지로 이동해 반을 선택할 수 있습니다.
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
            <Link to="/programs" className="rounded-full bg-slate-900/80 px-5 py-3 text-white transition hover:-translate-y-0.5">
              프로그램 페이지로 돌아가기
            </Link>
            <Link to="/" className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-gray-200 transition hover:border-white hover:text-white">
              홈으로 이동
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}


