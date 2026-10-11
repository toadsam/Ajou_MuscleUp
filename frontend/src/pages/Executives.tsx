// 운영진 명단. 서버에서 받지 않고 여기 적어 둔 값이다.
// 학기마다(운영진이 바뀔 때) 이 배열을 고쳐 주세요. 마지막 확인: 2026년 2학기.
type Lead = {
  name: string;
  role: string;
  focus: string;
  quote: string;
  /** 맡은 분야(한국어 짧은 낱말) */
  area: string;
};

const LEADS: readonly Lead[] = [
  {
    name: "정재훈",
    role: "대표 / 헤드 코치",
    focus: "전략, 퍼포먼스, 커뮤니티 방향성",
    quote: "탄탄한 시스템 위에서 멤버의 작은 성취가 큰 변화로 이어지게 만듭니다.",
    area: "총괄",
  },
  {
    name: "권상우",
    role: "부대표",
    focus: "운영 구조, 파트너십, 멤버 경험",
    quote: "운영의 디테일을 설계해 체감되는 퀄리티를 완성합니다.",
    area: "운영",
  },
  {
    name: "김세향",
    role: "총무",
    focus: "콘텐츠, 브랜딩, 스토리텔링",
    quote: "운동의 시간을 기록하고 공유 가능한 이야기로 확장합니다.",
    area: "브랜드",
  },
  {
    name: "유수정",
    role: "테크 리드",
    focus: "플랫폼, 데이터, AI 기능",
    quote: "기록과 데이터를 연결해 개인 맞춤형 운동 경험을 만듭니다.",
    area: "기술",
  },
  {
    name: "김명욱",
    role: "운영진",
    focus: "멤버 관리, 커뮤니티 운영",
    quote: "작은 불편도 놓치지 않고 더 나은 운영 경험으로 연결합니다.",
    area: "커뮤니티",
  },
];

export default function Executives() {
  return (
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="dg-steel relative overflow-hidden p-6 md:p-8">
          <p className="font-num text-sm font-bold text-plate-red">Leadership</p>
          <h1 className="mt-2 text-3xl md:text-5xl">운영진 소개</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm text-steel-300 md:text-base">
            득근득근을 꾸려 가는 운영진 {LEADS.length}명이에요. 동아리 운영이나 서비스에 대해 궁금한 점이 있으면 편하게 물어봐 주세요.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {LEADS.map((lead, idx) => (
            <article
              key={lead.name}
              className="dg-steel dg-lift dg-rise group relative overflow-hidden border-l-[8px] border-l-plate-red p-6"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-num text-sm font-bold text-steel-400">
                      {String(idx + 1).padStart(2, "0")}
                    </p>
                    <h3 className="font-display mt-1 text-2xl">{lead.name}</h3>
                    <p className="text-sm font-semibold text-red-300">{lead.role}</p>
                  </div>
                  <div className="dg-chip bg-plate-yellow text-sm text-black">
                    {lead.area}
                  </div>
                </div>

                <p className="dg-well px-3 py-2 text-xs font-semibold text-steel-200">{lead.focus}</p>
                <p className="text-sm leading-relaxed text-steel-200 italic">"{lead.quote}"</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
