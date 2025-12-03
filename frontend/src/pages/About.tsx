import { useEffect } from "react";
import { logEvent } from "../utils/analytics";

export default function About() {
  useEffect(() => {
    logEvent("about", "page_view");
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#0b1020] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-pink-500/25 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-32 h-96 w-80 rounded-full bg-indigo-500/20 blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute left-1/3 bottom-0 h-64 w-64 rounded-full bg-emerald-400/15 blur-[90px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 pb-24 pt-28 lg:px-10">
        {/* Hero */}
        <header className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4em] text-pink-200">We Are Deukgeun</p>
            <h1 className="text-4xl leading-tight md:text-5xl lg:text-6xl font-black">
              득근득근은 <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-300">성장과 기록</span>으로
              운동을 재미있게 만듭니다.
            </h1>
            <p className="text-lg text-gray-300 leading-relaxed">
              AI 맞춤 코칭, 커뮤니티 자랑방, 오프라인 모임, 그리고 과학적 루틴.
              운동의 모든 순간을 데이터로 남기고, 근거로 증명하는 사람들의 집입니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/register"
                className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-semibold shadow-xl shadow-pink-500/30 hover:opacity-90 transition"
              >
                지금 합류하기
              </a>
              <a
                href="/ai"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold hover:bg-white/10 transition"
              >
                AI 코칭 체험
              </a>
            </div>
          </div>
          <div className="relative h-full">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur shadow-2xl overflow-hidden">
              <div className="absolute -right-12 -top-10 h-32 w-32 rounded-full bg-purple-500/40 blur-2xl" />
              <div className="absolute -left-12 bottom-0 h-24 w-24 rounded-full bg-pink-500/30 blur-2xl" />
              <div className="relative space-y-4">
                <p className="text-sm text-gray-300">이번 주 커뮤니티 모먼트</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "완료 루틴", value: "438" },
                    { label: "자랑 업로드", value: "126" },
                    { label: "AI 상담", value: "312" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-black/40 border border-white/10 px-3 py-4">
                      <p className="text-2xl font-extrabold text-pink-200">{stat.value}</p>
                      <p className="text-xs text-gray-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-emerald-400/15 via-cyan-500/10 to-blue-500/20 border border-white/10 p-4">
                  <p className="text-sm font-semibold text-emerald-200">오늘의 미션</p>
                  <p className="text-lg font-bold mt-1">하체 + 코어 40분</p>
                  <p className="text-xs text-gray-300 mt-2">플랭크 / 런지 / 스쿼트 · AI가 강도 조절</p>
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
            },
            {
              title: "활발한 커뮤니티",
              desc: "자랑방, 후기, 번개 모임. 혼자 하기 힘든 날엔 함께 억지로라도 움직입니다.",
            },
            {
              title: "AI + 트레이너",
              desc: "AI 상담으로 즉시 피드백, 필요하면 트레이너가 개입해 세밀 조정.",
            },
          ].map((item, idx) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:-translate-y-1 hover:border-pink-400/40"
              style={{ transitionDelay: `${idx * 60}ms` }}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-pink-200">Pillar {idx + 1}</p>
              <h3 className="mt-2 text-xl font-bold">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-300 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* Timeline */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-white/10 to-white/5 p-6 backdrop-blur shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-purple-200">Our Flow</p>
              <h2 className="text-2xl font-extrabold">득근득근 한 사이클</h2>
            </div>
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200 border border-emerald-300/30">
              4 Step Routine
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            {[
              { title: "진단", desc: "AI 체성 분석 + 목표 설정, 오늘 컨디션 체크" },
              { title: "루틴", desc: "당일 루틴 추천, 강도 자동 조절" },
              { title: "기록", desc: "자랑방/후기로 커뮤니티에 공유, 피드백 받기" },
              { title: "회고", desc: "주간 리포트로 개선 포인트 확인" },
            ].map((step, idx) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-400">Step {idx + 1}</p>
                <p className="text-lg font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-gray-300">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature highlight */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr] items-center">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">AI + Community</p>
            <h2 className="text-3xl font-extrabold leading-tight">데이터로 설득하고, 커뮤니티로 유지합니다.</h2>
            <ul className="space-y-2 text-sm text-gray-200">
              <li>• AI 상담: 실시간 Q&A + 기록 공유/공유 해제</li>
              <li>• 자랑방: 사진·영상 업로드, 좋아요/댓글</li>
              <li>• 리뷰/단백질: 상품 후기와 공동구매</li>
              
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
            <div className="text-sm text-gray-300 mb-3">실시간 피드</div>
            <div className="space-y-2 text-sm">
              {[
                "AI 상담 요청 - 체형 교정 루틴",
                "자랑 업로드 - 데드리프트 150kg",
                "리뷰 작성 - 단백질 초코맛 ★★★★★",
                "관리자 삭제 - 갤러리 중복 파일",
              ].map((row, idx) => (
                <div
                  key={row}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
                  style={{ animationDelay: `${idx * 120}ms` }}
                >
                  <span>{row}</span>
                  <span className="text-xs text-pink-200">방금</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/80">Ready to Lift</p>
              <h3 className="text-2xl md:text-3xl font-extrabold text-white">득근득근 팀과 함께 근거 있는 운동을 시작하세요.</h3>
              <p className="text-sm text-white/80 mt-2">
                회원가입 후 AI 루틴 → 자랑방 → 오프라인 번개까지 한 번에 경험해 보세요.
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/register"
                className="rounded-full bg-white text-gray-900 px-5 py-3 text-sm font-semibold hover:opacity-90 transition"
              >
                무료 가입
              </a>
              <a
                href="/ai"
                className="rounded-full border border-white/50 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                AI 상담 바로가기
              </a>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
