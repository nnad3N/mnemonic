import { useEffect, useRef, useState } from "react";

type UseClampHeightProps = {
  lineLimit?: number;
  lineHeight?: number;
};

export const useClampHeight = <T extends HTMLElement>({
  lineLimit = 8,
  lineHeight = 1.25,
}: UseClampHeightProps = {}) => {
  const ref = useRef<T>(null);
  const [isHeightClamped, setIsHeightClamped] = useState(false);

  const maxHeight = lineLimit * lineHeight;

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const updateClampedState = (target: Element) => {
      const maxHeightPx = maxHeight * 16;
      const lineHeightPx = lineHeight * 16;
      const overflowHeight = target.scrollHeight - maxHeightPx;

      setIsHeightClamped(overflowHeight >= lineHeightPx);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(0);

      if (!entry) {
        return;
      }

      updateClampedState(entry.target);
    });

    observer.observe(element);
    updateClampedState(element);

    // oxlint-disable-next-line typescript/consistent-return
    return () => {
      observer.disconnect();
    };
  }, [lineHeight, maxHeight]);

  return {
    isHeightClamped,
    lineHeight: `${lineHeight}rem`,
    maxHeight: `${maxHeight}rem`,
    ref,
  };
};
