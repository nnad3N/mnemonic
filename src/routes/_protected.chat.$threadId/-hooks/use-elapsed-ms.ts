import { useEffect, useState } from "react";

const ELAPSED_TICK_MS = 1000;

type UseElapsedMsProps =
  | { enabled: false; startedAt?: never }
  | { enabled: true; startedAt: string };

export const useElapsedMs = ({ enabled, startedAt }: UseElapsedMsProps): number | undefined => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || startedAt === undefined) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, ELAPSED_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, startedAt]);

  if (!enabled) {
    return undefined;
  }

  return Math.max(0, nowMs - Date.parse(startedAt));
};
