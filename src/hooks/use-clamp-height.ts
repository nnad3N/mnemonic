import { useLayoutEffect, useRef, useState } from "react";

type UseClampHeightProps = {
  lineLimit?: number;
};

export const useClampHeight = <T extends HTMLElement>({
  lineLimit = 8,
}: UseClampHeightProps = {}) => {
  const ref = useRef<T>(null);
  const [isHeightClamped, setIsHeightClamped] = useState(false);
  const [lineHeight, setLineHeight] = useState<string | undefined>();
  const [maxHeight, setMaxHeight] = useState<string | undefined>();

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) return;

    const updateClampedState = (target: Element) => {
      const lineHeightPx = Number.parseFloat(getComputedStyle(target).lineHeight);

      if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return;

      const maxHeightPx = lineLimit * lineHeightPx;
      const overflowHeight = target.scrollHeight - maxHeightPx;

      setLineHeight(`${lineHeightPx}px`);
      setMaxHeight(`${maxHeightPx}px`);
      setIsHeightClamped(overflowHeight >= lineHeightPx);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(0);

      if (!entry) return;

      updateClampedState(entry.target);
    });

    observer.observe(element);
    updateClampedState(element);

    return () => {
      observer.disconnect();
    };
  }, [lineLimit]);

  return {
    isHeightClamped,
    lineHeight,
    maxHeight,
    ref,
  };
};
