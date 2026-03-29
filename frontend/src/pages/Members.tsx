type Member = {
  name: string;
  role: string;
  bio: string;
  tags: string[];
  vibe: string;
};

const memberNames = [
  "강민규",
  "강민제",
  "강승완",
  "경준",
  "고준영",
  "곽요환",
  "오다빈",
  "국윤",
  "권세용",
  "권용빈",
  "권유영",
  "김교진",
  "김규민",
  "김규민",
  "김기현",
  "김다희",
  "김도은",
  "김동욱",
  "김두영",
  "김명욱",
  "김민결",
  "김민석",
  "김민재",
  "김민찬",
  "김상겸",
  "김서준",
  "김재경",
  "김재현",
  "김재황",
  "김주찬",
  "김지광",
  "김찬주",
  "김찬호",
  "김현웅",
  "김환희",
  "동우",
  "맹준성",
  "문찬우",
  "민혁",
  "박수현",
  "박정근",
  "박지원",
  "박지훈",
  "배기혁",
  "배상오",
  "배의현",
  "백종민",
  "백지승",
  "상율",
  "서수영",
  "서청원",
  "김혜성",
  "송민혁",
  "송재혁",
  "시훈",
  "신동건",
  "안성균",
  "양준혁",
  "연서은",
  "연수",
  "오승진",
  "우찬",
  "유빈",
  "윤수현",
  "윤정아",
  "윤제현",
  "윤지섭",
  "이동하",
  "이민훈",
  "이상민",
  "이성호",
  "이수혁",
  "이슬",
  "이승명",
  "이승우",
  "이유진",
  "이윤서",
  "이윤호",
  "이재성",
  "이준범",
  "이준서",
  "이준엽",
  "이준호",
  "이중현",
  "이지우",
  "이지형",
  "이창우",
  "이하늘",
  "임예준",
  "임요섭",
  "임찬혁",
  "장예빈",
  "장윤솔",
  "이재건",
  "정도현",
  "정윤하",
  "정주원",
  "정준기",
  "정호준",
  "정환결",
  "조영훈",
  "조은재",
  "조은찬",
  "주안",
  "노준석",
  "준영",
  "한재성",
  "윤채영",
  "현종호",
  "현진",
];

const members: Member[] = memberNames.map((name) => ({
  name,
  role: "Ajou MuscleUp Member",
  bio: "아주머슬업에서 함께 운동하고 성장하는 멤버입니다.",
  tags: ["Ajou MuscleUp"],
  vibe: "Crew",
}));

const highlights = [
  { label: "전체 멤버", value: String(memberNames.length) },
  { label: "운영 프로그램", value: "18+" },
  { label: "월간 챌린지", value: "12" },
] as const;

export default function Members() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/35 p-6 shadow-[0_20px_70px_-35px_rgba(16,185,129,0.65)] md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
          <p className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            Team Members
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">멤버 소개</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
            코칭, 영양, 데이터, 콘텐츠까지 각자의 전문성이 연결되어 더 좋은 운동 경험을 만듭니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <p className="text-xs text-slate-300">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-emerald-100">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, idx) => (
            <article
              key={`${m.name}-${idx}`}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-[0_16px_40px_-30px_rgba(45,212,191,0.8)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-transparent opacity-90" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
                      Member {String(idx + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold">{m.name}</h3>
                    <p className="text-sm font-semibold text-emerald-200">{m.role}</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                    {m.vibe}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-200">{m.bio}</p>

                <div className="flex flex-wrap gap-2 text-xs">
                  {m.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-cyan-200/25 bg-cyan-500/10 px-3 py-1 text-cyan-50 transition group-hover:border-cyan-200/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
