import { useCountUp } from "../hooks/useCountUp";

// "05", "24/yr", "18+" 같은 값의 앞쪽 숫자만 굴려 올린다.
function StatValue({ value }: { value: string }) {
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? Number(match[1]) : 0;
  const v = useCountUp(target, { duration: 900 });
  if (!match) return <>{value}</>;
  return (
    <>
      {String(Math.round(v)).padStart(match[1].length, "0")}
      {match[2]}
    </>
  );
}

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
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="dg-steel relative overflow-hidden p-6 md:p-8">
          <p className="font-num text-sm font-bold text-plate-green">Team Members</p>
          <h1 className="mt-2 text-3xl md:text-5xl">멤버 소개</h1>
          <p className="mt-3 max-w-3xl text-sm text-steel-300 md:text-base">
            코칭, 영양, 데이터, 콘텐츠까지 각자의 전문성이 연결되어 더 좋은 운동 경험을 만듭니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="dg-well px-4 py-3">
                <p className="text-xs text-steel-400">{item.label}</p>
                <p className="font-num mt-1 text-4xl font-black text-plate-yellow">
                  <StatValue value={item.value} />
                </p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, idx) => (
            <article
              key={`${m.name}-${idx}`}
              className="dg-lift dg-rise group relative overflow-hidden rounded-xl border-[3px] border-black bg-steel-800 p-5 shadow-md"
              style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
            >
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-num text-sm font-bold text-steel-400">
                      Member {String(idx + 1).padStart(2, "0")}
                    </p>
                    <h3 className="font-display mt-1 text-2xl">{m.name}</h3>
                    <p className="font-num text-sm font-bold text-green-300">{m.role}</p>
                  </div>
                  <div className="dg-chip bg-steel-700 text-sm text-chalk transition-colors group-hover:bg-plate-yellow group-hover:text-black">
                    {m.vibe}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-steel-300">{m.bio}</p>

                <div className="flex flex-wrap gap-2 text-xs">
                  {m.tags.map((tag) => (
                    <span
                      key={tag}
                      className="dg-chip bg-steel-700 text-chalk"
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
