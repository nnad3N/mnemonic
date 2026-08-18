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

type CalculateToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-calculate" }>;

type ToCalculateMarkdownInput = {
  gt: GT;
  code: string;
  input: CalculateToolPart["input"];
  output: CalculateToolPart["output"];
};

const toCalculateMarkdown = ({ gt, code, input, output }: ToCalculateMarkdownInput): string => {
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

  if (input && Object.values(input).filter(Boolean).length > 0) {
    sections.push(`\`\`\`${gt("input")}\n${JSON.stringify(input, null, 2)}\n\`\`\``);
  }

  sections.push(`\`\`\`javascript\n${code}\n\`\`\``);

  return sections.join("\n\n");
};

type CalculatePartProps = {
  part: CalculateToolPart;
};

export const CalculatePart = ({ part }: CalculatePartProps) => {
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
          {toCalculateMarkdown({
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
