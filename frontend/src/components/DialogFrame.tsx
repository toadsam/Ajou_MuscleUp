import { useEffect, useId, useRef, type ReactNode } from "react";

// 화면 가운데 뜨는 작은 창(신고 · 차단 확인 · 회원 탈퇴 등)의 공용 틀.
// 열리면 첫 입력 칸으로 포커스를 옮기고, Esc 로 닫고, Tab 이 창 밖으로 나가지 않게 가둔다.
// 닫히면 열기 전에 포커스가 있던 곳으로 되돌린다. 짐 플로어(v2) 철판 카드.

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 제목 아래 짧은 설명(스크린 리더가 창 설명으로 읽는다) */
  description?: ReactNode;
  children: ReactNode;
  /** 처리 중이면 Esc · 바깥 클릭으로 닫지 않는다 */
  busy?: boolean;
  /** 위험한 작업 창이면 위 띠를 빨간색으로 */
  tone?: "default" | "danger";
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function DialogFrame({ open, onClose, title, description, children, busy = false, tone = "default" }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    if (!open) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => !el.hasAttribute("disabled"));
    // 첫 입력 칸(라디오 · 글상자)이 있으면 그쪽, 없으면 첫 버튼
    const firstField = dialog?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])");
    (firstField ?? focusables()[0])?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busyRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      returnFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/75 px-4 pb-4 pt-16 sm:items-center sm:pb-16"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="dg-steel dg-pop relative flex max-h-full w-full max-w-md flex-col overflow-hidden text-chalk"
      >
        <div aria-hidden="true" className={`h-2 flex-none border-b-2 border-black ${tone === "danger" ? "bg-plate-red" : "bg-plate-yellow"}`} />
        <div className="overflow-y-auto p-5 sm:p-6">
          <h2 id={titleId} className="font-display text-xl text-chalk">
            {title}
          </h2>
          {description && (
            <div id={descId} className="mt-2 text-sm leading-relaxed text-steel-300">
              {description}
            </div>
          )}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
