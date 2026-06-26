import { getToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import type {
  ToolPartStatus,
  WebSearchAgentToolPart,
} from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";

type WebSearchAgentCardProps = {
  part: WebSearchAgentToolPart;
};

const getStatusTitle = (status: ToolPartStatus): string => {
  if (status === "error") {
    return m.chat_thread_tool_web_search_error();
  }

  if (status === "done") {
    return m.chat_thread_tool_web_search_done();
  }

  return m.chat_thread_tool_web_search_pending();
};

export const WebSearchAgentCard = ({ part }: WebSearchAgentCardProps) => {
  const status = getToolPartStatus(part);

  return (
    <ThreadMetaLine
      className={cn(
        part.state === "input-streaming" && "shimmer",
        status === "error" && "text-destructive"
      )}
    >
      {getStatusTitle(status)}
    </ThreadMetaLine>
  );
};
