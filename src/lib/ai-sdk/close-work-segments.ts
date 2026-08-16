import type { MastraDBMessage } from "@mastra/core/agent/message-list";

import { createWorkEndPart } from "@/mastra/processors/work-segment-timing.server";
import type {
  ThreadUIMessagePart,
  WorkEndPart,
  WorkStartData,
  WorkStartPart,
} from "@/routes/_protected.chat.$threadId/-thread-types";

export type CloseableMessagePart =
  | ThreadUIMessagePart
  | MastraDBMessage["content"]["parts"][number];

const isWorkStartPart = (part: CloseableMessagePart): part is WorkStartPart =>
  part.type === "data-work-start";

const isWorkEndPart = (part: CloseableMessagePart): part is WorkEndPart =>
  part.type === "data-work-end";

export const closeWorkSegments = (
  parts: CloseableMessagePart[],
  completedAt: Temporal.Instant,
): CloseableMessagePart[] => {
  const openStarts: WorkStartData[] = [];

  for (const part of parts) {
    if (isWorkStartPart(part)) {
      openStarts.push(part.data);
      continue;
    }

    if (!isWorkEndPart(part)) {
      continue;
    }

    const openIndex = openStarts.findLastIndex((start) => start.segmentId === part.data.segmentId);

    if (openIndex !== -1) {
      openStarts.splice(openIndex, 1);
    }
  }

  if (openStarts.length === 0) {
    return parts;
  }

  for (const start of openStarts) {
    parts.push(createWorkEndPart(start, completedAt));
  }

  return parts;
};
