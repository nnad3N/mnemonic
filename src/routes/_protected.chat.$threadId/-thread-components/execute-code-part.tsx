import { createCodePlugin } from "@streamdown/code";
import type { ToolUIPart } from "ai";
import { Streamdown } from "streamdown";

import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import {
  CollapsibleToolIndicator,
  CollapsibleToolIndicatorContent,
  CollapsibleToolIndicatorTrigger,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
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
    return <AssistantToolPart part={part} />;
  }

  return (
    <CollapsibleToolIndicator>
      <CollapsibleToolIndicatorTrigger
        render={<AssistantToolPart interactive="collapsible" part={part} />}
      />
      <CollapsibleToolIndicatorContent className="pt-2">
        <Streamdown linkSafety={streamdownLinkSafety} mode="static" plugins={streamdownPlugins}>
          {toExecuteCodeMarkdown(code, part.output)}
        </Streamdown>
      </CollapsibleToolIndicatorContent>
    </CollapsibleToolIndicator>
  );
};
