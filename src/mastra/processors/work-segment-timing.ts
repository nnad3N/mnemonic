import type {
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
  Processor,
} from "@mastra/core/processors";
import type { ChunkType } from "@mastra/core/stream";
import { Result } from "better-result";
import { nanoid } from "nanoid";

import type { WorkEndPart, WorkStartData } from "@/routes/_protected.chat.$threadId/-thread-types";

type WorkSegmentTimingState = {
  segment?: { status: "closed" } | { status: "open"; start: WorkStartData };
  turnStarted?: boolean;
};

const getWorkState = (state: Record<string, unknown>): WorkSegmentTimingState =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Mastra processor state is untyped Record; we own this processor's shape.
  state as WorkSegmentTimingState;

export const createWorkEndPart = (
  start: WorkStartData,
  completedAt: Temporal.Instant,
): WorkEndPart => ({
  type: "data-work-end",
  data: {
    segmentId: start.segmentId,
    completedAt: completedAt.toString(),
    durationMs: Math.max(
      0,
      completedAt.since(Temporal.Instant.from(start.startedAt)).total("milliseconds"),
    ),
  },
});

const openWorkSegment = async (
  state: WorkSegmentTimingState,
  writer: ProcessOutputStreamArgs["writer"],
) => {
  if (state.segment?.status === "open" || writer === undefined) {
    return;
  }

  const start: WorkStartData = {
    segmentId: nanoid(),
    startedAt: Temporal.Now.instant().toString(),
  };

  state.segment = { status: "open", start };

  await writer.custom({
    type: "data-work-start",
    data: start,
  });
};

const finalizeWorkSegment = async (
  state: WorkSegmentTimingState,
  writer: ProcessOutputStreamArgs["writer"],
) => {
  if (state.segment?.status !== "open") {
    return;
  }

  const end = createWorkEndPart(state.segment.start, Temporal.Now.instant());
  state.segment = { status: "closed" };

  if (writer) {
    await Result.tryPromise(async () => writer.custom(end));
  }
};

export const workSegmentTimingProcessor = {
  id: "work-segment-timing",
  async processOutputStream({ part, state, writer }: ProcessOutputStreamArgs): Promise<ChunkType> {
    const workState = getWorkState(state);

    // oxlint-disable-next-line typescript/switch-exhaustiveness-check -- only a few stream chunk types open/close work segments.
    switch (part.type) {
      case "start":
      case "step-start": {
        if (!workState.turnStarted) {
          await openWorkSegment(workState, writer);
          workState.turnStarted = true;
        }
        break;
      }
      case "text-end": {
        await openWorkSegment(workState, writer);
        break;
      }
      case "text-start":
      case "finish":
      case "error":
      case "abort": {
        await finalizeWorkSegment(workState, writer);
        break;
      }
      default: {
        break;
      }
    }

    return part;
  },
  async processOutputResult({ messageList, state, writer }: ProcessOutputResultArgs) {
    await finalizeWorkSegment(getWorkState(state), writer);

    return messageList;
  },
} satisfies Processor;
