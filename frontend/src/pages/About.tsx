import { useEffect } from "react";
import { logEvent } from "../utils/analytics";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";

function StatNumber({ value, start }: { value: string; start: boolean }) {
  const v = useCountUp(Number(value), { duration: 1000, start });
  return <>{Math.round(v)}</>;
}

export default function About() {
  useEffect(() => {
    logEvent("about", "page_view");
  }, []);

  const [statsRef, statsInView] = useInView<HTMLDivElement>();

  return (
    <section className="relative overflow-hidden text-white">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 pb-24 pt-28 lg:px-10">
        {/* Hero */}
        <header className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] items-center">
          <div className="dg-rise space-y-6">
            <p className="font-num text-base font-bold text-plate-red">We Are Deukgeun</p>
            <h1 className="text-4xl leading-tight md:text-5xl lg:text-6xl">
              득근득근은 <span className="text-plate-yellow">성장과 기록</span>으로
              운동을 재미있게 만듭니다.
            </h1>
            <p className="text-lg text-steel-300 leading-relaxed">
              AI 맞춤 코칭, 커뮤니티 자랑방, 오프라인 모임, 그리고 과학적 루틴.
              운동의 모든 순간을 데이터로 남기고, 근거로 증명하는 사람들의 집입니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="/register" className="dg-btn dg-btn-primary px-6 text-sm">
                지금 합류하기
              </a>
              <a href="/ai" className="dg-btn dg-btn-steel px-6 text-sm">
                AI 코칭 체험
              </a>
            </div>
          </div>
          <div className="relative h-full">
            <div className="dg-steel dg-rise overflow-hidden p-6" style={{ animationDelay: "120ms" }}>
              <div className="relative space-y-4">
                <p className="text-sm font-semibold text-steel-300">이번 주 커뮤니티 모먼트</p>
                <div ref={statsRef} className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "완료 루틴", value: "438" },
                    { label: "자랑 업로드", value: "126" },
                    { label: "AI 상담", value: "312" },
                  ].map((stat) => (
                    <div key={stat.label} className="dg-well px-3 py-4">
                      <p className="font-num text-4xl font-black text-plate-yellow">
                        <StatNumber value={stat.value} start={statsInView} />
                      </p>
                      <p className="text-xs text-steel-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="dg-well border-l-[6px] border-l-plate-green p-4">
                  <p className="text-sm font-semibold text-green-300">오늘의 미션</p>
                  <p className="text-lg font-bold mt-1">하체 + 코어 40분</p>
                  <p className="text-xs text-steel-300 mt-2">플랭크 / 런지 / 스쿼트 · AI가 강도 조절</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Pillars */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "근거 기반 루틴",
              desc: "운동·영양 데이터를 수집하고 루틴을 계속 진화시켜요. 보여주기 식 루틴은 거부.",
              plate: "bg-plate-red",
            },
            {
              title: "활발한 커뮤니티",
              desc: "자랑방, 후기, 번개 모임. 혼자 하기 힘든 날엔 함께 억지로라도 움직입니다.",
              plate: "bg-plate-blue",
            },
            {
              title: "AI + 트레이너",
              desc: "AI 상담으로 즉시 피드백, 필요하면 트레이너가 개입해 세밀 조정.",
              plate: "bg-plate-yellow",
            },
          ].map((item, idx) => (
            <div
              key={item.title}
              className="dg-steel dg-lift dg-rise group p-6"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`h-8 w-3 rounded-sm border-2 border-black transition-transform duration-200 group-hover:scale-y-125 ${item.plate}`}
                />
                <p className="font-num text-sm font-bold text-steel-400">Pillar {idx + 1}</p>
              </div>
              <h3 className="font-display mt-3 text-xl">{item.title}</h3>
              <p className="mt-2 text-sm text-steel-300 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* Timeline */}
        <section className="dg-whiteboard p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-num text-sm font-bold text-board-blue">Our Flow</p>
              <h2 className="font-pen text-4xl leading-none">득근득근 한 사이클</h2>
            </div>
            <span className="dg-chip bg-plate-green text-sm text-white">4 Step Routine</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            {[
              { title: "진단", desc: "AI 체성 분석 + 목표 설정, 오늘 컨디션 체크" },
              { title: "루틴", desc: "당일 루틴 추천, 강도 자동 조절" },
              { title: "기록", desc: "자랑방/후기로 커뮤니티에 공유, 피드백 받기" },
              { title: "회고", desc: "주간 리포트로 개선 포인트 확인" },
            ].map((step, idx) => (
              <div
                key={step.title}
                className="dg-rise rounded-md border-2 border-dashed border-board-frame p-4"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <p className="font-num text-sm font-bold text-board-red">Step {idx + 1}</p>
                <p className="text-lg font-bold">{step.title}</p>
                <p className="mt-1 opacity-80">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature highlight */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr] items-center">
          <div className="space-y-3">
            <p className="font-num text-sm font-bold text-plate-yellow">AI + Community</p>
            <h2 className="text-3xl font-display leading-tight">데이터로 설득하고, 커뮤니티로 유지합니다.</h2>
            <ul className="space-y-2 text-sm text-steel-200">
              <li>• AI 상담: 실시간 Q&A + 기록 공유/공유 해제</li>
              <li>• 자랑방: 사진·영상 업로드, 좋아요/댓글</li>
              <li>• 리뷰/단백질: 상품 후기와 공동구매</li>

            </ul>
          </div>
          <div className="dg-steel p-6">
            <div className="text-sm font-semibold text-steel-300 mb-3">실시간 피드</div>
            <div className="space-y-2 text-sm">
              {[
                "AI 상담 요청 - 체형 교정 루틴",
                "자랑 업로드 - 데드리프트 150kg",
                "리뷰 작성 - 단백질 초코맛 ★★★★★",
                "관리자 삭제 - 갤러리 중복 파일",
              ].map((row, idx) => (
                <div
                  key={row}
                  className="dg-well dg-rise flex items-center justify-between px-4 py-3"
                  style={{ animationDelay: `${idx * 120}ms` }}
                >
                  <span>{row}</span>
                  <span className="font-num text-sm font-bold text-plate-yellow">방금</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-2xl border-[3px] border-black bg-plate-red p-8 shadow-xl">
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-num text-base font-bold text-white/85">Ready to Lift</p>
              <h3 className="font-display text-2xl md:text-3xl text-white">득근득근 팀과 함께 근거 있는 운동을 시작하세요.</h3>
              <p className="text-sm text-white/85 mt-2">
                회원가입 후 AI 루틴 → 자랑방 → 오프라인 번개까지 한 번에 경험해 보세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/register" className="dg-btn dg-chalk-burst bg-chalk px-5 text-sm text-black">
                무료 가입
              </a>
              <a href="/ai" className="dg-btn dg-btn-steel px-5 text-sm">
                AI 상담 바로가기
              </a>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
