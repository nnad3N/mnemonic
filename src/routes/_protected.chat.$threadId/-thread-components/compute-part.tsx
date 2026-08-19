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

type ComputeToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-compute" }>;

type ToComputeMarkdownInput = {
  gt: GT;
  code: string;
  input: ComputeToolPart["input"];
  output: ComputeToolPart["output"];
};

const toComputeMarkdown = ({ gt, code, input, output }: ToComputeMarkdownInput): string => {
  const sections: string[] = [];

  if (output?.type === "success") {
    if (output.result !== undefined) {
      sections.push(
        `###### ${gt("Output")}\n\n\`\`\`json\n${JSON.stringify(output.result, null, 2)}\n\`\`\``,
      );
    }

    if (output.logs) {
      sections.push(`###### ${gt("Logs")}\n\n\`\`\`text\n${output.logs}\n\`\`\``);
    }
  }

  if (output?.type === "error") {
    sections.push(`###### ${gt("Error")}\n\n\`\`\`text\n${output.name}: ${output.message}\n\`\`\``);
  }

  if (input && Object.values(input).filter(Boolean).length > 0) {
    sections.push(`###### ${gt("Input")}\n\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``);
  }

  sections.push(`###### ${gt("Code")}\n\n\`\`\`javascript\n${code}\n\`\`\``);

  return sections.join("\n\n");
};

type ComputePartProps = {
  part: ComputeToolPart;
};

export const ComputePart = ({ part }: ComputePartProps) => {
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
          {toComputeMarkdown({
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
