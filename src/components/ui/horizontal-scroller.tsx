import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const WHEEL_SCROLL_FACTOR = 0.4;

type HorizontalScrollerProps = PropsWithChildren<{
  className?: string;
}>;

export const HorizontalScroller = ({ children, className }: HorizontalScrollerProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      if (viewport.scrollWidth <= viewport.clientWidth) return;

      event.preventDefault();
      viewport.scrollLeft += event.deltaY * WHEEL_SCROLL_FACTOR;
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={cn("no-scrollbar min-w-0 overflow-x-auto", className)} ref={viewportRef}>
      {children}
    </div>
  );
};
