import { createCodePlugin } from "@streamdown/code";
import type { ToolUIPart } from "ai";
import { ChevronRightIcon } from "lucide-react";
import { Streamdown } from "streamdown";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

const streamdownPlugins = {
  code: createCodePlugin(),
};

type ExecuteCodeToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-executeCode" }>;

type ExecuteCodePartProps = {
  part: ExecuteCodeToolPart;
};

export const ExecuteCodePart = ({ part }: ExecuteCodePartProps) => {
  const code = part.input?.code;

  if (!code) {
    return <AssistantToolPart part={part} />;
  }

  return (
    <Collapsible>
      <CollapsibleTrigger
        className="group/trigger flex items-center gap-0.5"
        render={<AssistantToolPart part={part} />}
      >
        <ChevronRightIcon className="size-4 shrink-0 opacity-0 transition-opacity group-hover/trigger:opacity-100 group-data-panel-open/trigger:rotate-90 group-data-panel-open/trigger:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <Streamdown mode="static" plugins={streamdownPlugins}>
          {`\`\`\`javascript\n${code}\n\`\`\``}
        </Streamdown>
      </CollapsibleContent>
    </Collapsible>
  );
};
