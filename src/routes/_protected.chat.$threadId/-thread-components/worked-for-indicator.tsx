import { T, useGT, useLocale } from "gt-tanstack-start";
import { useState } from "react";

import { CollapsibleContent } from "@/components/ui/collapsible";
import { isVisibleIntermediatePart } from "@/lib/ai-sdk/tool-parts";
import { getDominantWorkActivityKind, type WorkActivityKind } from "@/lib/ai-sdk/work-part";
import { cn } from "@/lib/utils";
import { useElapsedMs } from "@/routes/_protected.chat.$threadId/-hooks/use-elapsed-ms";
import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";
import { AssistantMessagePart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message-part";
import {
  CollapsibleToolIndicator,
  CollapsibleToolIndicatorTrigger,
  ToolIndicator,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

const formatDuration = (locale: string, durationMs: number): string => {
  const totalSeconds = Math.max(1, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds <= 60) {
    return new Intl.DurationFormat(locale, { style: "narrow" }).format({
      seconds: totalSeconds,
    });
  }

  return new Intl.DurationFormat(locale, { style: "narrow" }).format({
    minutes,
    seconds,
  });
};

const getDurationMs = (startedAt?: string, completedAt?: string): number | undefined => {
  if (!startedAt || !completedAt) {
    return undefined;
  }

  const duration = Temporal.Instant.from(completedAt).since(Temporal.Instant.from(startedAt));

  return Math.max(0, duration.total("milliseconds"));
};

type WorkedForIndicatorProps = {
  /** When the text closing this run started; unset while the run is still going. */
  completedAt: string | undefined;
  messageParts: ThreadUIMessagePart[];
  parts: ThreadUIMessagePart[];
  startedAt: string | undefined;
};

type WorkTickerState = {
  current: number;
  previous?: number;
  phase: "entering" | "holding" | "settled";
};

const TICKER_HOLD_MS = 700;

export const WorkedForIndicator = ({
  completedAt,
  messageParts,
  parts,
  startedAt,
}: WorkedForIndicatorProps) => {
  const { isStreaming } = useMessageState();
  const activityKind = getDominantWorkActivityKind(parts);
  const pending = isStreaming && !completedAt;
  const durationMs = getDurationMs(startedAt, completedAt);
  const elapsedMs = useElapsedMs(
    pending && startedAt ? { enabled: true, startedAt } : { enabled: false },
  );

  const visibleParts = parts.filter(isVisibleIntermediatePart);
  const latestIndex = visibleParts.length - 1;

  const [ticker, setTicker] = useState<WorkTickerState>({
    current: latestIndex,
    phase: "entering",
  });
  if (ticker.phase === "settled" && ticker.current < latestIndex) {
    setTicker({ current: latestIndex, previous: ticker.current, phase: "entering" });
  }

  const currentPart = visibleParts.at(ticker.current);
  const previousPart = ticker.previous === undefined ? undefined : visibleParts.at(ticker.previous);

  return (
    <CollapsibleToolIndicator className="group/work">
      <CollapsibleToolIndicatorTrigger
        render={<ToolIndicator interactive="collapsible" pending={pending} />}
      >
        <WorkLabel
          activityKind={activityKind}
          durationMs={durationMs}
          elapsedMs={elapsedMs}
          pending={pending}
        />
      </CollapsibleToolIndicatorTrigger>
      {isStreaming && currentPart && (
        <div
          className={cn(
            "relative grid overflow-hidden transition-[grid-template-rows] duration-700 ease-out group-data-open/work:hidden",
            pending ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div
            className={cn(
              "relative min-h-0 w-max max-w-full transition-[translate,opacity] duration-700 ease-out",
              !pending && "-translate-y-4 opacity-0",
            )}
          >
            {previousPart && (
              <div
                className="pointer-events-none absolute inset-s-0 top-1 w-max max-w-full animate-out duration-700 ease-out fill-mode-forwards fade-out slide-out-to-top-4"
                key={ticker.previous}
              >
                <AssistantMessagePart messageParts={messageParts} part={previousPart} />
              </div>
            )}
            <div
              className={cn(
                "w-max max-w-full pt-1",
                ticker.phase === "entering" &&
                  "animate-in duration-700 ease-out zoom-in-95 fade-in slide-in-from-bottom-4",
              )}
              data-test-id="work-ticker-current"
              key={ticker.current}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }

                setTicker((state) => ({ ...state, previous: undefined, phase: "holding" }));
                window.setTimeout(() => {
                  setTicker((state) => ({ ...state, phase: "settled" }));
                }, TICKER_HOLD_MS);
              }}
            >
              <AssistantMessagePart messageParts={messageParts} part={currentPart} />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-linear-to-b from-background to-transparent" />
        </div>
      )}
      <CollapsibleContent className="overflow-hidden pt-2">
        <div className="flex flex-col gap-2">
          {parts.map((part, offset) => (
            <AssistantMessagePart key={offset} messageParts={messageParts} part={part} />
          ))}
        </div>
      </CollapsibleContent>
    </CollapsibleToolIndicator>
  );
};

type WorkLabelProps = {
  activityKind: WorkActivityKind;
  durationMs: number | undefined;
  elapsedMs: number | undefined;
  pending: boolean;
};

const WorkLabel = ({ activityKind, durationMs, elapsedMs, pending }: WorkLabelProps) => {
  const gt = useGT();
  const locale = useLocale();

  switch (activityKind) {
    case "research": {
      if (pending) {
        if (elapsedMs === undefined) {
          return <T>Researching...</T>;
        }

        return gt("Researching for {duration}...", {
          duration: formatDuration(locale, elapsedMs),
        });
      }

      if (durationMs === undefined) {
        return <T>Researched for a while</T>;
      }

      return gt("Researched for {duration}", { duration: formatDuration(locale, durationMs) });
    }
    case "default": {
      if (pending) {
        if (elapsedMs === undefined) {
          return <T>Working...</T>;
        }

        return gt("Working for {duration}...", { duration: formatDuration(locale, elapsedMs) });
      }

      if (durationMs === undefined) {
        return <T>Worked for a while</T>;
      }

      return gt("Worked for {duration}", { duration: formatDuration(locale, durationMs) });
    }
  }
};
