import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName } from "ai";

import { cn } from "@/lib/utils";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";
import { getToolLabels } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ToolLabels } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

type AssistantToolPartProps = {
  part: DynamicToolUIPart | ToolUIPart<ThreadUITools>;
};

type ToolPartStatus = "done" | "error" | "pending";

const getToolPartStatus = (
  part: DynamicToolUIPart | ToolUIPart<ThreadUITools>
): ToolPartStatus => {
  switch (part.state) {
    case "output-error":
    case "output-denied": {
      return "error";
    }
    case "output-available": {
      return part.preliminary === true ? "pending" : "done";
    }
    case "input-streaming":
    case "input-available":
    case "approval-requested":
    case "approval-responded": {
      return "pending";
    }
    default: {
      return "pending";
    }
  }
};

const getToolPartLabel = (
  status: ToolPartStatus,
  labels: ToolLabels
): string => {
  if (status === "error") {
    return labels.error();
  }

  if (status === "done") {
    return labels.done();
  }

  return labels.pending();
};

export const AssistantToolPart = ({ part }: AssistantToolPartProps) => {
  const labels = getToolLabels(getToolName(part));

  if (labels === null) {
    return null;
  }

  const status = getToolPartStatus(part);

  return (
    <ThreadMetaLine
      className={cn(
        part.state === "input-streaming" && "shimmer",
        status === "error" && "text-destructive"
      )}
    >
      {getToolPartLabel(status, labels)}
    </ThreadMetaLine>
  );
};
