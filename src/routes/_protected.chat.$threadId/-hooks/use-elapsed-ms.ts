import { useEffect, useState } from "react";

const ELAPSED_TICK_MS = 1000;

type UseElapsedMsProps =
  | { enabled: false; startedAt?: never }
  | { enabled: true; startedAt: string };

export const useElapsedMs = ({ enabled, startedAt }: UseElapsedMsProps): number | undefined => {
  const [nowMs, setNowMs] = useState(() => Temporal.Now.instant().epochMilliseconds);

  useEffect(() => {
    if (!enabled || startedAt === undefined) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Temporal.Now.instant().epochMilliseconds);
    }, ELAPSED_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, startedAt]);

  if (!enabled) {
    return undefined;
  }

  return Math.max(0, nowMs - Temporal.Instant.from(startedAt).epochMilliseconds);
};
