import { useEffect, useState, type ReactNode } from "react";
import DialogFrame from "../DialogFrame";
import { tierStepOf } from "./chibiArt";
import { rememberSeen, risenFrom } from "./seenStore";

// 티어가 오르는 순간(2026-10-20) — 홈에서 티어가 이 기기에서 지난번 본 것보다 오르면 한 번 보여 준다.
// 예전 티어 모습이 떨리다가 새 장비를 찬 모습이 튀어나오고(BodyStageUp 과 같은 움직임), 새로 얻은 장비 이름을 적는다.
// 끝나면(또는 보여 줄 게 없으면) onDone — 홈은 그다음에 "몸이 커졌어요"를 띄운다(창이 겹치지 않게).

const KEY = "tier_seen_v1";
const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
/** 티어 단계마다 하나씩 차는 장비(chibiArt 티어 장비와 같은 순서) */
const GEAR = ["", "손목 보호대", "벨트", "무릎 보호대", "머리띠", "금 버클", "금 벨트", "금 신발"];

type Props = {
  seedKey: string;
  tier: string;
  /** 그 티어로 그린 내 캐릭터 */
  renderAvatar: (tier: string, size: number) => ReactNode;
  onDone?: () => void;
};

export default function TierUp({ seedKey, tier, renderAvatar, onDone }: Props) {
  const step = tierStepOf(tier);
  const [from] = useState<number | null>(() => risenFrom(KEY, seedKey, step));
  const [open, setOpen] = useState(from !== null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (from === null) {
      rememberSeen(KEY, seedKey, step); // 처음 보거나 그대로 · 내려감: 조용히 기억하고 다음 순서로
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setGrown(true), 700);
    return () => window.clearTimeout(id);
    // onDone 은 처음 한 번만 부르면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, seedKey, step]);

  if (from === null || !open) return null;
  const close = () => {
    rememberSeen(KEY, seedKey, step);
    setOpen(false);
    onDone?.();
  };
  const gained = GEAR.slice(from + 1, step + 1).filter(Boolean);

  return (
    <DialogFrame open onClose={close} title="티어가 올랐어요" description={`${TIERS[from] ?? ""} → ${tier}`}>
      <div className="relative mx-auto mt-2 flex h-[168px] w-[168px] items-end justify-center" aria-hidden="true">
        {grown ? (
          <div key="new" className="pxa-grow-new">
            {renderAvatar(tier, 156)}
          </div>
        ) : (
          <div key="old" className="pxa-grow-old">
            {renderAvatar(TIERS[from] ?? "BRONZE", 156)}
          </div>
        )}
      </div>
      <p className="mt-3 text-center font-num text-2xl uppercase text-plate-yellow">{tier}</p>
      {gained.length > 0 && <p className="mt-1 text-center text-sm text-steel-300">새 장비: {gained.join(" · ")}</p>}
      <button type="button" className="dg-btn dg-btn-primary mt-4 min-h-[44px] w-full" onClick={close}>
        좋아요
      </button>
    </DialogFrame>
  );
}
