import { createCodePlugin } from "@streamdown/code";
import type { ToolUIPart } from "ai";
import { useGT } from "gt-tanstack-start";
import { Streamdown } from "streamdown";

import { CollapsibleContent } from "@/components/ui/collapsible";
import type { GT } from "@/lib/gt";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import {
  CollapsibleToolIndicator,
  CollapsibleToolIndicatorTrigger,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

const streamdownPlugins = {
  code: createCodePlugin(),
};

type ExecuteCodeToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-executeCode" }>;

type ToExecuteCodeMarkdownInput = {
  gt: GT;
  code: string;
  input: ExecuteCodeToolPart["input"];
  output: ExecuteCodeToolPart["output"];
};

const toExecuteCodeMarkdown = ({ gt, code, input, output }: ToExecuteCodeMarkdownInput): string => {
  const sections: string[] = [];

  if (output?.type === "success") {
    if (output.result !== undefined) {
      sections.push(`\`\`\`${gt("output")}\n${JSON.stringify(output.result, null, 2)}\n\`\`\``);
    }

    if (output.logs) {
      sections.push(`\`\`\`${gt("logs")}\n${output.logs}\n\`\`\``);
    }
  }

  if (output?.type === "error") {
    sections.push(`\`\`\`${gt("error")}\n${output.name}: ${output.message}\n\`\`\``);
  }

  if (input) {
    sections.push(`\`\`\`${gt("input")}\n${JSON.stringify(input, null, 2)}\n\`\`\``);
  }

  sections.push(`\`\`\`javascript\n${code}\n\`\`\``);

  return sections.join("\n\n");
};

type ExecuteCodePartProps = {
  part: ExecuteCodeToolPart;
};

export const ExecuteCodePart = ({ part }: ExecuteCodePartProps) => {
  const gt = useGT();
  const { code, ...input } = part.input ?? {};

  if (!code) {
    return <AssistantToolPart part={part} />;
  }

  return (
    <CollapsibleToolIndicator>
      <CollapsibleToolIndicatorTrigger
        render={<AssistantToolPart interactive="collapsible" part={part} />}
      />
      <CollapsibleContent className="overflow-hidden pt-2">
        <Streamdown linkSafety={streamdownLinkSafety} mode="static" plugins={streamdownPlugins}>
          {toExecuteCodeMarkdown({
            gt,
            code,
            input,
            output: part.output,
          })}
        </Streamdown>
      </CollapsibleContent>
    </CollapsibleToolIndicator>
  );
};
