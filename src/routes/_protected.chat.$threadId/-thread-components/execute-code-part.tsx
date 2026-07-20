import { createCodePlugin } from "@streamdown/code";
import type { ToolUIPart } from "ai";
import { ChevronRightIcon } from "lucide-react";
import { Streamdown } from "streamdown";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

const streamdownPlugins = {
  code: createCodePlugin(),
};

type ExecuteCodeToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-executeCode" }>;

type ExecuteCodePartProps = {
  part: ExecuteCodeToolPart;
};

const toExecuteCodeMarkdown = (code: string, output: ExecuteCodeToolPart["output"]): string => {
  const sections = [`\`\`\`javascript\n${code}\n\`\`\``];

  if (output?.type === "success") {
    if (output.result !== undefined) {
      sections.push(`\`\`\`json\n${JSON.stringify(output.result, null, 2)}\n\`\`\``);
    }

    if (output.logs) {
      sections.push(`\`\`\`logs\n${output.logs}\n\`\`\``);
    }
  }

  if (output?.type === "error") {
    sections.push(`\`\`\`error\n${output.name}: ${output.message}\n\`\`\``);
  }

  return sections.join("\n\n");
};

export const ExecuteCodePart = ({ part }: ExecuteCodePartProps) => {
  const code = part.input?.code;

  if (!code) {
    return <AssistantToolPart part={part} interactive={false} />;
  }

  return (
    <Collapsible>
      <CollapsibleTrigger render={<AssistantToolPart part={part} interactive />}>
        <ChevronRightIcon className="opacity-0 transition-opacity group-hover/tool:opacity-100 group-data-panel-open/tool:rotate-90 group-data-panel-open/tool:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <Streamdown linkSafety={streamdownLinkSafety} mode="static" plugins={streamdownPlugins}>
          {toExecuteCodeMarkdown(code, part.output)}
        </Streamdown>
      </CollapsibleContent>
    </Collapsible>
  );
};
