import { useCountUp } from "../../hooks/useCountUp";
import { useInView } from "../../hooks/useInView";

type CountUpProps = {
  value: number | null | undefined;
  decimals?: number;
  duration?: number;
  /** 값이 없을 때 보여줄 글자 */
  placeholder?: string;
  className?: string;
};

// 화면에 처음 보일 때 0 에서 값까지 굴러 올라가는 숫자
export default function CountUp({ value, decimals = 0, duration = 900, placeholder = "--", className }: CountUpProps) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const current = useCountUp(value ?? null, { duration, start: inView });

  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span ref={ref} className={className}>
        {placeholder}
      </span>
    );
  }

  return (
    <span ref={ref} className={className} aria-label={value.toLocaleString("ko-KR", { maximumFractionDigits: decimals })}>
      <span aria-hidden="true">
        {current.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
    </span>
  );
}
