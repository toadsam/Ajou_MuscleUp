import { useEffect, useRef } from "react";
import { PLAZA_THEME_IDS, PLAZA_THEMES, paintPlazaPreview, type PlazaThemeId } from "./plaza";

// 모임 설정 "라운지 모습" — 다섯 가지 광장 중 하나. 칸마다 분수 둘레를 잘라 그린 작은 미리보기.

function Preview({ theme }: { theme: PlazaThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPlazaPreview(ref.current, theme);
  }, [theme]);
  return <canvas ref={ref} className="block aspect-[4/3] w-full rounded-sm [image-rendering:pixelated]" aria-hidden="true" />;
}

export default function PlazaThemePicker({ value, onChange }: { value: PlazaThemeId; onChange: (v: PlazaThemeId) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="라운지 모습">
      {PLAZA_THEME_IDS.map((id) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={`rounded border-2 p-1 text-left ${on ? "border-plate-yellow bg-steel-800" : "border-black bg-steel-900 hover:border-steel-500"}`}
          >
            <Preview theme={id} />
            <span className={`mt-1 block truncate text-xs font-bold ${on ? "text-plate-yellow" : "text-steel-300"}`}>{PLAZA_THEMES[id].label}</span>
          </button>
        );
      })}
    </div>
  );
}
