import { useCallback, useMemo } from "react";
import PhotoShareEditor from "../share/PhotoShareEditor";
import { shareFileName } from "../../lib/photoCard";
import { RUN_TOGGLES, runCardContent, type RunShareData, type RunShow } from "../../lib/runShareCard";

// 러닝 공유 카드 만들기(전체 화면) — 편집 화면은 출석 공유와 같은 PhotoShareEditor.

type Props = { data: RunShareData; onClose: () => void };

export default function RunShareEditor({ data, onClose }: Props) {
  const hasRoute = Boolean(data.route && data.route.length > 1);
  const toggles = useMemo(() => RUN_TOGGLES.map((t) => (t.key === "route" && !hasRoute ? { ...t, disabled: true } : t)), [hasRoute]);
  const build = useCallback((show: Record<string, boolean>) => runCardContent(data, show as RunShow), [data]);
  return (
    <PhotoShareEditor
      layout="fullscreen"
      onClose={onClose}
      toggles={toggles}
      initialShow={{ distance: true, pace: true, time: true, route: hasRoute, date: true }}
      build={build}
      fileName={shareFileName("run", data.startedAt)}
      shareTitle="득근득근 러닝"
      note={!hasRoute ? <p className="text-xs text-steel-500">이 러닝은 이 휴대폰에 코스가 없어요(직접 입력 · 다른 기기).</p> : null}
    />
  );
}
