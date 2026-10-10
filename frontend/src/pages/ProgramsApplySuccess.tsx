import type { CSSProperties } from "react";
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

// 신청 완료 순간: 원판 두 장이 양쪽에서 철컥 끼워지고 가운데 체크가 튀어나온다.
const SUCCESS_PLATES = [
  { cls: "bg-plate-red h-12", from: "-36px", delay: "0ms" },
  { cls: "bg-plate-blue h-10", from: "-36px", delay: "90ms" },
];

export default function ProgramsApplySuccess() {
  const location = useLocation();
  const form = (location.state as { form?: SuccessFormState } | null)?.form;

  return (
    <section className="min-h-screen px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="dg-steel p-8 sm:p-10">
          <div className="flex items-center gap-1.5" aria-hidden>
            {[...SUCCESS_PLATES].reverse().map((p) => (
              <span
                key={`l-${p.cls}`}
                className={`dg-plate-in w-3 rounded-sm border-2 border-black ${p.cls}`}
                style={{ "--from": p.from, animationDelay: p.delay } as CSSProperties}
              />
            ))}
            <span className="dg-pop mx-1 grid h-12 w-12 place-items-center rounded-full border-[3px] border-black bg-plate-green text-white shadow-md" style={{ animationDelay: "180ms" }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            {SUCCESS_PLATES.map((p) => (
              <span
                key={`r-${p.cls}`}
                className={`dg-plate-in w-3 rounded-sm border-2 border-black ${p.cls}`}
                style={{ "--from": p.from.replace("-", ""), animationDelay: p.delay } as CSSProperties}
              />
            ))}
          </div>
          <p className="font-num mt-5 text-base font-bold text-orange-300">Programs</p>
          <h1 className="mt-1 text-4xl text-white">반 신청이 접수되었습니다.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-steel-300">
            설문 결과와 신청 정보를 기준으로 운영 흐름을 확인한 뒤 연결됩니다. 지금 선택한 반과 추천 근거를 아래에서 다시 확인할 수 있습니다.
          </p>

          {form ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
              <div className="dg-well dg-rise p-6 text-white" style={{ animationDelay: "120ms" }}>
                <p className="text-sm font-bold text-orange-300">신청 정보</p>
                <div className="mt-5 space-y-4 text-sm leading-6 text-steel-200">
                  <div>
                    <p className="text-steel-400">이름</p>
                    <p className="font-semibold text-white">{form.name}</p>
                  </div>
                  <div>
                    <p className="text-steel-400">이메일</p>
                    <p className="font-semibold text-white">{form.email}</p>
                  </div>
                  <div>
                    <p className="text-steel-400">최종 신청 반</p>
                    <p className="font-semibold text-white">{form.track}</p>
                  </div>
                  <div>
                    <p className="text-steel-400">한 줄 목표</p>
                    <p className="font-semibold text-white whitespace-pre-wrap">{form.personalGoal || "입력 없음"}</p>
                  </div>
                </div>
              </div>

              <div className="dg-well dg-rise p-6" style={{ animationDelay: "200ms" }}>
                <p className="text-sm font-bold text-steel-400">추천 결과</p>
                <div className="mt-5 space-y-4 text-sm leading-6 text-steel-300">
                  <div>
                    <p className="text-steel-400">설문 추천 반</p>
                    <p className="font-semibold text-white">{form.recommendedTrack || "직접 선택"}</p>
                  </div>
                  <div>
                    <p className="text-steel-400">현재 단계</p>
                    <p className="font-semibold text-white">{form.readiness || "직접 선택"}</p>
                  </div>
                  <div>
                    <p className="text-steel-400">추천 이유</p>
                    <div className="mt-2 space-y-2">
                      {(form.recommendationReasons && form.recommendationReasons.length > 0
                        ? form.recommendationReasons
                        : ["설문 없이 원하는 반을 직접 선택했습니다."]
                      ).map((reason) => (
                        <div key={reason} className="rounded border-2 border-black border-l-[6px] border-l-plate-yellow bg-steel-800 px-4 py-3 text-steel-200">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-steel-400">운영 메모</p>
                    <p className="font-semibold text-white">{form.coachingPoint || "선택한 반 기준으로 운영 흐름이 안내됩니다."}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="dg-well mt-8 border-dashed p-6 text-sm leading-6 text-steel-300">
              신청 요약 정보를 찾지 못했습니다. 다시 신청 페이지로 이동해 반을 선택할 수 있습니다.
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
            <Link to="/programs" className="dg-btn dg-btn-primary px-5">
              프로그램 페이지로 돌아가기
            </Link>
            <Link to="/" className="dg-btn dg-btn-steel px-5">
              홈으로 이동
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}


