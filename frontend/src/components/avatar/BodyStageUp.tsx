import { useEffect, useState, type ReactNode } from "react";
import DialogFrame from "../DialogFrame";
import { BODY_STAGE_NAMES } from "./chibiArt";

// 몸이 커지는 순간(2026-10-20) — 홈에서 몸 단계(서버 BodyStage)가 이 기기에서 지난번 본 값보다 오르면 한 번 보여 준다.
// 예전 몸이 떨리다가(0.7초) 새 몸이 튀어나온다(0.6초). 처음 보는 기기는 지금 값을 기억만 하고 띄우지 않는다.
// 펌핑(+1)은 넘기지 않는다 — 운동 직후마다 "커졌어요"가 뜨지 않게.

const KEY = "body_stage_seen_v1";

const readSeen = (): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const remember = (seedKey: string, stage: number) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), [seedKey]: stage }));
  } catch {
    // 저장 못 하는 브라우저(사생활 보호 창)면 다음에 또 보일 뿐이다
  }
};

type Props = {
  /** 캐릭터마다 따로 기억(아바타 시드) */
  seedKey: string;
  /** 지금 몸 단계 0~5 */
  stage: number;
  /** 몸 단계 b 로 그린 내 캐릭터 */
  renderAvatar: (bodyStage: number, size: number) => ReactNode;
};

export default function BodyStageUp({ seedKey, stage, renderAvatar }: Props) {
  // 캐릭터를 불러온 뒤에 붙인다(key 로 다시 만든다) — 처음 값만 보면 된다
  const [from] = useState<number | null>(() => {
    const prev = readSeen()[seedKey];
    return typeof prev === "number" && stage > prev ? prev : null;
  });
  const [open, setOpen] = useState(from !== null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (from === null) {
      remember(seedKey, stage); // 처음 보거나 그대로 · 내려감: 조용히 기억
      return;
    }
    const id = window.setTimeout(() => setGrown(true), 700);
    return () => window.clearTimeout(id);
  }, [from, seedKey, stage]);

  if (from === null || !open) return null;
  const close = () => {
    remember(seedKey, stage);
    setOpen(false);
  };
  const name = (s: number) => `단계 ${s} · ${BODY_STAGE_NAMES[s] ?? ""}`;

  return (
    <DialogFrame open onClose={close} title="몸이 커졌어요" description={`${name(from)} → ${name(stage)}`}>
      <div className="relative mx-auto mt-2 flex h-[168px] w-[168px] items-end justify-center" aria-hidden="true">
        {grown ? (
          <div key="new" className="pxa-grow-new">
            {renderAvatar(stage, 156)}
          </div>
        ) : (
          <div key="old" className="pxa-grow-old">
            {renderAvatar(from, 156)}
          </div>
        )}
      </div>
      <p className="mt-3 text-center font-display text-lg text-plate-yellow">{name(stage)}</p>
      <p className="mt-1 text-center text-sm text-steel-300">레벨 · 활동 · 근육 중 가장 높은 값이 올라서 어깨와 팔이 더 굵어졌어요.</p>
      <button type="button" className="dg-btn dg-btn-primary mt-4 min-h-[44px] w-full" onClick={close}>
        좋아요
      </button>
    </DialogFrame>
  );
}
