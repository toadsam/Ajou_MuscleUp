import { useCallback, useEffect, useState } from "react";

// 요소가 화면에 처음 들어온 순간을 알려준다. 한 번 true 가 되면 계속 true.
// callback ref 라서 데이터가 늦게 와 나중에 그려지는 요소도 붙는 순간부터 관찰한다.
export function useInView<T extends Element>(options: IntersectionObserverInit = { threshold: 0.25 }) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useCallback((element: T | null) => setNode(element), []);
  const { threshold, rootMargin } = options;

  useEffect(() => {
    if (!node || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, threshold, rootMargin]);

  return [ref, inView] as const;
}
