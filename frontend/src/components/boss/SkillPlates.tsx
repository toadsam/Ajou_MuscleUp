import { SKILLS, SKILL_META, type ShadowSkill } from "../../lib/shadow";

// 기술 원판 5개 + 초크 통(치명타 토큰). 통에 남은 힘이 0 이면 회색(눌러도 "이번 주 가슴 운동 없음").
// 원판 색은 통 구분(국제 규격 색 그대로). 한 손 · 세로 화면에서 엄지로 닿게 56px.

type Props = {
  charge: Record<ShadowSkill, number>;
  disabled?: boolean;
  picked?: ShadowSkill | null;
  onPick: (skill: ShadowSkill) => void;
  critTokens: number;
  critArmed: boolean;
  onToggleCrit: () => void;
  /** 작은 화면용 (기본은 가로 5칸) */
  compact?: boolean;
};

export function PlateIcon({ skill, size = 56, empty = false, picked = false }: { skill: ShadowSkill; size?: number; empty?: boolean; picked?: boolean }) {
  const meta = SKILL_META[skill];
  return (
    <span
      className={`relative flex items-center justify-center rounded-full border-[3px] border-steel-950 ${picked ? "ring-2 ring-plate-yellow ring-offset-2 ring-offset-steel-950" : ""}`}
      style={{ width: size, height: size, background: empty ? "#3C3E44" : meta.color, boxShadow: empty ? "none" : "inset 0 -4px 0 rgba(0,0,0,0.25)" }}
      aria-hidden="true"
    >
      <span className="block rounded-full border-2 border-steel-950 bg-steel-900" style={{ width: size * 0.3, height: size * 0.3 }} />
    </span>
  );
}

export default function SkillPlates({ charge, disabled = false, picked = null, onPick, critTokens, critArmed, onToggleCrit }: Props) {
  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-5 gap-1" role="group" aria-label="기술">
        {SKILLS.map((skill) => {
          const meta = SKILL_META[skill];
          const left = charge[skill] ?? 0;
          const empty = left <= 0;
          return (
            <li key={skill} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onPick(skill)}
                disabled={disabled}
                aria-disabled={empty}
                aria-label={`${meta.label} — ${meta.pool} 힘 ${left}`}
                className={`dg-plate-btn flex flex-col items-center gap-1 rounded-sm px-1 pt-1 ${disabled ? "opacity-70" : ""}`}
              >
                <PlateIcon skill={skill} empty={empty} picked={picked === skill} />
                <span className={`font-num text-lg leading-none ${empty ? "text-steel-500" : "text-white"}`}>{left}</span>
              </button>
              <span className={`text-[11px] leading-none ${empty ? "text-steel-600" : "text-steel-300"}`}>{meta.label}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onToggleCrit}
          disabled={disabled || critTokens <= 0}
          aria-pressed={critArmed}
          className={`dg-chip flex items-center gap-2 px-3 py-1.5 text-sm ${critTokens <= 0 ? "text-steel-500" : critArmed ? "border-plate-yellow text-plate-yellow" : "text-steel-200"}`}
        >
          <span className="inline-block h-4 w-4 rounded-sm border-2 border-steel-950 bg-chalk" aria-hidden="true" />
          초크 통 ×{critTokens}
          <span className="font-num text-xs uppercase tracking-wider">{critTokens <= 0 ? "자기 기록을 깨면 생겨요" : critArmed ? "다음 타 치명타" : "치명타 켜기"}</span>
        </button>
      </div>
    </div>
  );
}
