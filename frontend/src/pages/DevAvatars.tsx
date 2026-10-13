// 개발 전용: 픽셀 아바타의 모든 변형을 한 화면에서 본다 (로그인 없이). App.tsx 에서 DEV 일 때만 라우트를 연다.
import type { ReactNode } from "react";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { ActionKind, Equip } from "../components/avatar/pixelAvatar";
import { barbellLoad } from "../lib/liftMotion";
import ExerciseIcon from "../components/lifts/ExerciseIcon";
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

export default function DevAvatars() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pb-20 pt-24">
      <h1 className="text-4xl">픽셀 아바타 갤러리</h1>

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
