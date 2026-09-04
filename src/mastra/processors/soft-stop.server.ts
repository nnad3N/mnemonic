import type { OnDelegationStartHandler } from "@mastra/core/agent";
import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
  Processor,
} from "@mastra/core/processors";

import * as Kit from "@/lib/kit";
import { READER_AGENT_ID, WORKER_AGENT_ID } from "@/mastra/models.server";

/**
 * A subagent whose last step goes to a tool call has no step left to write in, and returns empty
 * text to the parent. One step past the tool budget runs with no tools, so the model answers.
 */
const createSoftStop = (toolCallSteps: number) => ({
  maxSteps: toolCallSteps + 1,
  processor: {
    id: "soft-stop",
    processInputStep({
      stepNumber,
      systemMessages,
    }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
      if (stepNumber < toolCallSteps) {
        return;
      }

      return {
        activeTools: [],
        systemMessages: [
          ...systemMessages,
          { role: "system", content: "No tools left. Write report now from what you have." },
        ],
      };
    },
  } satisfies Processor,
});

export const readerSoftStop = createSoftStop(5);
export const workerSoftStop = createSoftStop(15);

const SubagentId = Kit.literals.from()([READER_AGENT_ID, WORKER_AGENT_ID]);

/** Mastra lets the delegating model pick the subagent's step budget, and caps it only from above. */
export const pinSubagentSteps: OnDelegationStartHandler = ({ primitiveId }) => {
  if (!SubagentId.is(primitiveId)) {
    return;
  }

  switch (primitiveId) {
    case READER_AGENT_ID:
      return { modifiedMaxSteps: readerSoftStop.maxSteps };
    case WORKER_AGENT_ID:
      return { modifiedMaxSteps: workerSoftStop.maxSteps };
  }
};
