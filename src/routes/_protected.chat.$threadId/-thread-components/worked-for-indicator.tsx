import { T, useGT, useLocale } from "gt-tanstack-start";
import type { PropsWithChildren } from "react";

import { CollapsibleContent } from "@/components/ui/collapsible";
import {
  getDominantWorkActivityKind,
  getWorkRunTiming,
  type WorkActivityKind,
} from "@/lib/ai-sdk/work-part";
import { useElapsedMs } from "@/routes/_protected.chat.$threadId/-hooks/use-elapsed-ms";
import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";
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

type WorkedForIndicatorProps = {
  parts: ThreadUIMessagePart[];
};

export const WorkedForIndicator = ({
  children,
  parts,
}: PropsWithChildren<WorkedForIndicatorProps>) => {
  const { isStreaming } = useMessageState();
  const { startedAt, durationMs } = getWorkRunTiming(parts);
  const activityKind = getDominantWorkActivityKind(parts);
  const pending = isStreaming && durationMs === undefined;
  const elapsedMs = useElapsedMs(
    pending && startedAt ? { enabled: true, startedAt } : { enabled: false },
  );

  return (
    <CollapsibleToolIndicator>
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
      <CollapsibleContent className="overflow-hidden pt-2">
        <div className="flex flex-col gap-2">{children}</div>
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
