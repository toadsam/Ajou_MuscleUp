// 개발 전용: 픽셀 아바타의 모든 변형을 한 화면에서 본다 (로그인 없이). App.tsx 에서 DEV 일 때만 라우트를 연다.
import { useState, type ReactNode } from "react";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import BodyStageUp from "../components/avatar/BodyStageUp";
import ChibiAvatar from "../components/avatar/ChibiAvatar";
import type { ChibiExpression, ChibiVariant } from "../components/avatar/chibiArt";
import type { ActionKind, Equip } from "../components/avatar/pixelAvatar";
import { barbellLoad } from "../lib/liftMotion";
import ExerciseIcon from "../components/lifts/ExerciseIcon";
import RunTrack from "../components/running/RunTrack";
import { LIFT_EXERCISES } from "../lib/lifts";
import { exerciseGuide } from "../lib/exerciseGuide";
import { defaultGrowthParams, type CharacterTier, type GrowthParams } from "../components/avatar/types";

const MOTIONS: [ActionKind, Equip][] = [
  ["squat", "barbell"],
  ["deadlift", "barbell"],
  ["press", "barbell"],
  ["bench", "barbell"],
  ["curl", "dumbbell"],
  ["raise", "dumbbell"],
  ["fly", "dumbbell"],
  ["pullup", "none"],
  ["legraise", "none"],
  ["pushup", "none"],
  ["press", "dumbbell"],
  ["flex", "none"],
  ["run", "none"],
];

const TIERS: CharacterTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];

const growth = (muscle: number, fat = 0): GrowthParams => ({
  ...defaultGrowthParams,
  muscularityNormalized: muscle,
  shoulderGrowth: muscle,
  fatNormalized: fat,
});

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dg-well flex flex-col items-center gap-2 overflow-hidden px-2 pb-2 pt-8">
      {children}
      <span className="text-center text-xs text-steel-300">{label}</span>
    </div>
  );
}

/** 움직임(2026-10-20) 확인: 숨쉬기 · 이긴 순간(누르면 다시) · 몸이 커지는 순간 창 */
function MotionLifeDemo() {
  const [win, setWin] = useState(0);
  const [grow, setGrow] = useState<string | null>(null);
  const avatar = (bodyStage: number, size: number, stage = 1) => (
    <AvatarRenderer avatarSeed="jaehun" tier="GOLD" stage={stage} gender="MALE" mbti="ESTJ" bodyStage={bodyStage} size={size} />
  );
  const openGrow = () => {
    // 이 기기에서 "지난번 본 몸 단계 2" 로 적어 두고 4 로 띄운다
    const key = `dev-grow-${Date.now()}`;
    try {
      const seen = JSON.parse(localStorage.getItem("body_stage_seen_v1") || "{}") as Record<string, number>;
      localStorage.setItem("body_stage_seen_v1", JSON.stringify({ ...seen, [key]: 2 }));
    } catch {
      // 개발 화면: 저장 못 하면 창이 안 뜰 뿐
    }
    setGrow(key);
  };
  return (
    <section className="space-y-3" id="motion-life">
      <h2 className="font-bold text-plate-yellow">움직임 — 숨쉬기 · 이긴 순간 · 몸이 커지는 순간</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="숨쉬기 · 서기">{avatar(2, 120)}</Cell>
        <Cell label="숨쉬기 · 알통">{avatar(4, 120, 3)}</Cell>
        <Cell label="숨쉬기 · 쉬는 중">
          <AvatarRenderer avatarSeed="mina" tier="SILVER" stage={1} gender="FEMALE" mbti="ENFP" bodyStage={1} isResting size={120} />
        </Cell>
        <Cell label="이긴 순간 · 누르면 다시">
          <button type="button" onClick={() => setWin((w) => w + 1)} aria-label="이긴 순간 다시 보기">
            <AvatarRenderer
              key={win}
              avatarSeed="jaehun"
              tier="GOLD"
              stage={3}
              gender="MALE"
              mbti="ESTJ"
              bodyStage={3}
              size={120}
              action={{ kind: "flex", frame: 1, equip: "none", plates: [] }}
              pumped
              celebrate
            />
          </button>
        </Cell>
      </div>
      <button type="button" className="dg-btn dg-btn-steel min-h-[44px] px-4 text-sm" onClick={openGrow}>
        몸이 커지는 순간 보기(단계 2 → 4)
      </button>
      {grow && <BodyStageUp key={grow} seedKey={grow} stage={4} renderAvatar={(b, size) => avatar(b, size)} />}
    </section>
  );
}

export default function DevAvatars() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pb-20 pt-24">
      <h1 className="text-4xl">픽셀 아바타 갤러리</h1>

      <MotionLifeDemo />

      {/* ── 치비 시안 B(2026-10-20, 사용자 선택): 머리 큰 2.5등신 · 몸 단계 0 새싹 → 5 전설. 실제 화면은 아직 아래의 지금 그림 ── */}
      <section className="space-y-4" id="chibi">
        <h2 className="font-bold text-plate-yellow">치비 시안 B — 몸 단계 0 새싹 → 5 전설 (헐렁한 민소매 → 몸에 붙는 V → 끈 나시 · 크롭탑)</h2>
        {[
          { label: "남 · 서기", female: false, pose: "stand" as const, seed: "jaehun", mbti: "ESTJ" },
          { label: "남 · 알통", female: false, pose: "flex" as const, seed: "jaehun", mbti: "ESTJ" },
          { label: "여 · 서기", female: true, pose: "stand" as const, seed: "mina", mbti: "ENFP" },
          { label: "여 · 알통", female: true, pose: "flex" as const, seed: "mina", mbti: "ENFP" },
        ].map((row) => (
          <div key={row.label} className="space-y-2">
            <p className="text-sm text-steel-300">{row.label}</p>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
              {([0, 1, 2, 3, 4, 5] as const).map((s) => (
                <Cell key={s} label={`단계 ${s} · ${["새싹", "입문", "근력", "벌크", "괴력", "전설"][s]}`}>
                  <ChibiAvatar
                    seed={row.seed}
                    mbti={row.mbti}
                    variant="B"
                    bodyStage={s}
                    fat={0}
                    female={row.female}
                    expression={row.pose === "flex" ? "strain" : s >= 4 ? "smile" : "normal"}
                    pose={row.pose}
                    size={120}
                  />
                </Cell>
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-2">
          <p className="text-sm text-steel-300">표정 5가지(단계 2) · 체지방 · 머리 모양</p>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {(["normal", "smile", "strain", "tired", "sparkle"] as ChibiExpression[]).map((ex) => (
              <Cell key={ex} label={{ normal: "기본", smile: "웃음", strain: "힘줌", tired: "지침", sparkle: "반짝" }[ex]}>
                <ChibiAvatar seed="jaehun" mbti="ESTJ" variant="B" bodyStage={2} fat={0} female={false} expression={ex} pose="stand" size={112} />
              </Cell>
            ))}
            <Cell label="체지방 높음">
              <ChibiAvatar seed="jaehun" mbti="INTP" variant="B" bodyStage={1} fat={1} female={false} expression="smile" pose="stand" size={112} />
            </Cell>
            {["a", "b", "c", "d"].map((seed) => (
              <Cell key={seed} label={`머리 시드 ${seed}`}>
                <ChibiAvatar seed={`hair-${seed}`} mbti="ISFP" variant="B" bodyStage={3} fat={0} female={false} expression="normal" pose="stand" size={112} />
              </Cell>
            ))}
            <Cell label="여 · 똥머리">
              <ChibiAvatar seed="seoyeon" mbti="ISTJ" variant="B" bodyStage={2} fat={0} female expression="smile" pose="stand" size={112} />
            </Cell>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-steel-300">작은 크기(지도 · 라운지 · 목록): 지금 그림 vs 시안 B 단계 0 · 3 · 5</p>
          <div className="flex flex-wrap items-end gap-4">
            {[40, 56, 72].map((size) => (
              <div key={size} className="flex items-end gap-2">
                <AvatarRenderer avatarSeed="jaehun" tier="GOLD" stage={2} mbti="ESTJ" growthParams={growth(0.5)} size={size} />
                {([0, 3, 5] as const).map((s) => (
                  <ChibiAvatar key={s} seed="jaehun" mbti="ESTJ" variant="B" bodyStage={s} fat={0} female={false} expression="smile" pose="stand" size={size} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <details className="text-sm text-steel-400">
          <summary className="cursor-pointer">다른 비율(A 2등신 · C 3등신) 보기</summary>
          <div className="mt-2 grid grid-cols-3 gap-3 md:grid-cols-6">
            {(["A", "C"] as ChibiVariant[]).flatMap((variant) =>
              ([0, 3, 5] as const).map((s) => (
                <Cell key={`${variant}${s}`} label={`${variant} · 단계 ${s}`}>
                  <ChibiAvatar seed="jaehun" mbti="ESTJ" variant={variant} bodyStage={s} fat={0} female={false} expression="normal" pose="stand" size={100} />
                </Cell>
              )),
            )}
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">진화 단계 1 → 8 (MASTER, TITAN, 근육 0.7)</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => (
            <Cell key={i} label={`STAGE ${i + 1}`}>
              <AvatarRenderer avatarSeed="jaehun" tier="MASTER" stage={i + 1} mbti="ESTJ" growthParams={growth(0.7)} evolutionBranch="TITAN" size={120} />
            </Cell>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">티어별 장비 (STAGE 2)</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {TIERS.map((tier) => (
            <Cell key={tier} label={tier}>
              <AvatarRenderer avatarSeed="tier-demo" tier={tier} stage={2} mbti="INTJ" growthParams={growth(0.45)} size={120} />
            </Cell>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">근육 단계 · 체지방 · 성별 · MBTI</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {[0, 0.35, 0.7, 1].map((m) => (
            <Cell key={`m${m}`} label={`근육 ${m}`}>
              <AvatarRenderer avatarSeed="build" tier="GOLD" stage={1} mbti="ISFP" growthParams={growth(m)} size={120} />
            </Cell>
          ))}
          <Cell label="체지방 높음">
            <AvatarRenderer avatarSeed="build" tier="GOLD" stage={1} mbti="ENFP" growthParams={growth(0.2, 0.8)} size={120} />
          </Cell>
          {["a", "b"].map((seed) => (
            <Cell key={seed} label={`여성 ${seed}`}>
              <AvatarRenderer avatarSeed={`female-${seed}`} tier="DIAMOND" stage={4} gender="FEMALE" mbti="ENFJ" growthParams={growth(0.4)} size={120} />
            </Cell>
          ))}
          <Cell label="MBTI 없음">
            <AvatarRenderer avatarSeed="plain" tier="BRONZE" stage={1} growthParams={growth(0.1)} size={120} />
          </Cell>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">상태 · 갈래 · 스킬 · 머리 모양</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          <Cell label="펌핑(운동 직후)">
            <AvatarRenderer avatarSeed="rest" tier="PLATINUM" stage={5} pumped mbti="INFP" growthParams={growth(0.5)} size={120} />
          </Cell>
          <Cell label="장착 민소매(남색)">
            <AvatarRenderer avatarSeed="rest" tier="PLATINUM" stage={5} tank="#1F3A6B" mbti="INFP" growthParams={growth(0.5)} size={120} />
          </Cell>
          <Cell label="휴식 중">
            <AvatarRenderer avatarSeed="rest" tier="PLATINUM" stage={5} isResting mbti="INFP" growthParams={growth(0.5)} size={120} />
          </Cell>
          <Cell label="출석 경고">
            <AvatarRenderer avatarSeed="warn" tier="SILVER" stage={3} attendanceRisk="warning" mbti="ESTP" growthParams={growth(0.3)} size={120} />
          </Cell>
          <Cell label="오래 쉼(다시 시작해요)">
            <AvatarRenderer avatarSeed="crit" tier="MASTER" stage={8} attendanceRisk="critical" mbti="ESTJ" growthParams={growth(0.9)} evolutionBranch="TITAN" size={120} />
          </Cell>
          {(["TITAN", "BLAZE", "PHANTOM"] as const).map((b) => (
            <Cell key={b} label={`${b} · 스킬 전부`}>
              <AvatarRenderer
                avatarSeed={`branch-${b}`}
                tier="GRANDMASTER"
                stage={7}
                mbti="ENTJ"
                growthParams={growth(0.8)}
                evolutionBranch={b}
                activeSkillIds={["aura", "wave", "branch", "burst"]}
                unlockedSkillCount={4}
                size={120}
              />
            </Cell>
          ))}
          {["h0", "h1x", "h22"].map((seed) => (
            <Cell key={seed} label={`시드 ${seed}`}>
              <AvatarRenderer avatarSeed={seed} tier="BRONZE" stage={1} mbti="ISTJ" growthParams={growth(0.2)} size={120} />
            </Cell>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">운동 동작 (운동 세션 · 프레임 0 → 1, 바벨 100kg)</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {MOTIONS.flatMap(([kind, equip]) =>
            ([0, 1] as const).map((frame) => (
              <Cell key={`${kind}-${equip}-${frame}`} label={`${kind} · ${equip} · ${frame}`}>
                <AvatarRenderer
                  avatarSeed="lift"
                  tier="DIAMOND"
                  stage={2}
                  mbti="ESTP"
                  growthParams={growth(0.5)}
                  size={96}
                  action={{ kind, frame, equip, plates: barbellLoad(100).pixel }}
                />
              </Cell>
            )),
          )}
        </div>
        <h2 className="font-bold">원판 무게별 (스쿼트 · 근육 단계 0 / 3)</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {[20, 42.5, 60, 100, 140, 182.5, 250, 320].map((kg, i) => (
            <Cell key={kg} label={`${kg}kg`}>
              <AvatarRenderer
                avatarSeed="lift"
                tier="GOLD"
                stage={2}
                mbti="INTJ"
                growthParams={growth(i % 2 ? 1 : 0)}
                size={96}
                action={{ kind: i % 3 === 2 ? "bench" : "squat", frame: 0, equip: "barbell", plates: barbellLoad(kg).pixel }}
              />
            </Cell>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">종목 그림 (31종목 · 두 장면 반복 · 팁)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {LIFT_EXERCISES.map((e) => (
            <div key={e.code} className="dg-well flex items-center gap-3 p-2">
              <ExerciseIcon info={e} size={72} animate />
              <div className="min-w-0 text-xs">
                <p className="font-bold">{e.label}</p>
                <p className="text-steel-400">{exerciseGuide(e).target}</p>
                <p className="text-steel-300">{exerciseGuide(e).tip}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">러닝 캐릭터 (5'30"/km · 1.73km / 멈춤)</h2>
        <div className="grid max-w-md gap-3">
          <RunTrack character={{ avatarSeed: "run", tier: "GOLD", evolutionStage: 2, growthParams: growth(0.5) }} mbti="ENFP" pace={330} paused={false} distanceM={1730} />
          <RunTrack character={{ avatarSeed: "run", tier: "GOLD", evolutionStage: 2, growthParams: growth(0.5) }} mbti="ENFP" pace={null} paused distanceM={980} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">작은 크기 (목록·라운지)</h2>
        <div className="flex flex-wrap items-end gap-4">
          {[40, 56, 72, 96].map((s) => (
            <AvatarRenderer key={s} avatarSeed="jaehun" tier="MASTER" stage={8} mbti="ESTJ" growthParams={growth(0.7)} evolutionBranch="TITAN" size={s} />
          ))}
        </div>
      </section>
    </main>
  );
}
