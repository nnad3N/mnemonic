import { getToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import type {
  ToolPartStatus,
  TopicAgentToolPart,
} from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";

type TopicAgentPartProps = {
  part: TopicAgentToolPart;
};

const getStatusTitle = (status: ToolPartStatus): string => {
  if (status === "error") {
    return m.chat_thread_tool_topic_agent_error();
  }

  if (status === "done") {
    return m.chat_thread_tool_topic_agent_done();
  }

  return m.chat_thread_tool_topic_agent_pending();
};

export const TopicAgentPart = ({ part }: TopicAgentPartProps) => {
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
