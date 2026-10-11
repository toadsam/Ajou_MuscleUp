// 동아리 멤버 명단(실명). 로그인한 회원에게만 보인다(App.tsx 에서 ProtectedRoute 로 감쌈).
// 서버에서 받지 않고 여기 적어 둔 값이라, 학기마다 명단이 바뀌면 이 배열을 고쳐 주세요.
const MEMBER_NAMES: readonly string[] = [
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


export default function Members() {
  return (
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="dg-steel relative overflow-hidden p-6 md:p-8">
          <p className="font-num text-sm font-bold text-plate-green">Members</p>
          <h1 className="mt-2 text-3xl md:text-5xl">멤버 소개</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm text-steel-300 md:text-base">
            득근득근에서 함께 운동하는 멤버 {MEMBER_NAMES.length}명이에요. 회원끼리만 볼 수 있어요.
          </p>
        </header>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MEMBER_NAMES.map((name, idx) => (
            <li
              key={`${name}-${idx}`}
              className="dg-rise flex items-center gap-3 rounded-lg border-[3px] border-black bg-steel-800 px-4 py-3 shadow-md"
              style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
            >
              <span className="font-num text-sm font-bold text-steel-500">{String(idx + 1).padStart(2, "0")}</span>
              <span className="font-display text-lg">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
