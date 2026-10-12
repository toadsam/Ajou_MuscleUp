import DialogFrame from "../DialogFrame";
import Barbell from "../gym/Barbell";
import { formatKg, type LiftSaveResult } from "../../lib/lifts";

type Props = {
  result: LiftSaveResult | null;
  onClose: () => void;
};

/** 개인 최고를 깼을 때 — 원판이 끼워지는 바벨(눌러서 들기)과 얼마나 늘었는지, 3대 기록 · 점수 변화 */
export default function PrCelebration({ result, onClose }: Props) {
  const pr = result?.pr ?? null;
  if (!result || !pr) return null;
  const diff = pr.previousE1rm != null ? Math.round((pr.e1rm - pr.previousE1rm) * 10) / 10 : null;
  return (
    <DialogFrame
      open
      onClose={onClose}
      title={pr.first ? `${pr.label} 첫 기록!` : `${pr.label} 개인 최고 갱신!`}
      description={pr.first ? "다음 기록부터 이 값과 비교해요." : "지금까지 든 것 중 가장 무거워요(추정 1RM 기준)."}
    >
      <div className="space-y-4">
        <Barbell loaded={7} height={96} liftable label={`${pr.label} 추정 1RM ${formatKg(pr.e1rm)}kg`} />
        <div className="text-center">
          <p className="font-num text-5xl leading-none text-plate-yellow">
            {formatKg(pr.e1rm)}
            <span className="ml-1 text-2xl text-steel-300">kg</span>
          </p>
          <p className="mt-1 text-sm text-steel-300">
            추정 1RM
            {diff != null && (
              <>
                {" · "}이전 {formatKg(pr.previousE1rm ?? 0)}kg에서 <strong className="text-plate-green">+{formatKg(diff)}kg</strong>
              </>
            )}
          </p>
        </div>
        {result.statUpdate && (
          <p className="dg-well p-3 text-sm text-steel-200">
            마이페이지 3대 기록도 바꿨어요: {result.statUpdate.label}{" "}
            {result.statUpdate.before != null ? `${formatKg(result.statUpdate.before)} → ` : ""}
            <strong className="text-white">{formatKg(result.statUpdate.after)}kg</strong>. 캐릭터도 다시 평가했어요.
          </p>
        )}
        {result.points > 0 && <p className="text-center text-sm font-semibold text-plate-yellow">활동 점수 +{result.points}</p>}
        <button type="button" onClick={onClose} className="dg-btn dg-btn-primary min-h-[44px] w-full text-base">
          좋아요
        </button>
      </div>
    </DialogFrame>
  );
}
