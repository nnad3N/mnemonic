import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName } from "ai";

import { getToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import type { ToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";
import { getToolLabels } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ToolLabels } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

type AssistantToolPartProps = {
  part: DynamicToolUIPart | ToolUIPart<ThreadUITools>;
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
        status === "pending" && "shimmer",
        status === "error" && "text-destructive"
      )}
    >
      {getToolPartLabel(status, labels)}
    </ThreadMetaLine>
  );
};
