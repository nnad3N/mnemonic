import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { isToolUIPart } from "ai";
import { useTheme } from "next-themes";
import { Streamdown } from "streamdown";

import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";
import { AssistantReasoningPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-reasoning-part";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { ExecuteCodePart } from "@/routes/_protected.chat.$threadId/-thread-components/execute-code-part.tsx";
import { OmPart } from "@/routes/_protected.chat.$threadId/-thread-components/om-part";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import { WebFetchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-fetch-part";
import { WebSearchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-search-part";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

const streamdownPlugins = {
  code: createCodePlugin(),
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid: createMermaidPlugin(),
};

type AssistantMessagePartProps = {
  part: ThreadUIMessagePart;
};

export const AssistantMessagePart = ({ part }: AssistantMessagePartProps) => {
  const { isStreaming } = useMessageState();
  const { resolvedTheme } = useTheme();

  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (part.type) {
    case "text": {
      return (
        <Streamdown
          isAnimating={isStreaming}
          linkSafety={streamdownLinkSafety}
          mermaid={{
            config: {
              theme: resolvedTheme === "dark" ? "dark" : "default",
            },
          }}
          plugins={streamdownPlugins}
        >
          {part.text}
        </Streamdown>
      );
    }
    case "reasoning": {
      return <AssistantReasoningPart part={part} />;
    }
    case "tool-webSearch": {
      return <WebSearchPart part={part} />;
    }
    case "tool-webFetch": {
      return <WebFetchPart part={part} />;
    }
    case "tool-executeCode": {
      return <ExecuteCodePart part={part} />;
    }
    case "tool-recall": {
      return <AssistantToolPart part={part} />;
    }
    case "data-om-observation-start":
    case "data-om-observation-end":
    case "data-om-observation-failed":
    case "data-om-buffering-start":
    case "data-om-buffering-end":
    case "data-om-buffering-failed":
    case "data-om-activation": {
      return <OmPart part={part} />;
    }

    default: {
      if (isToolUIPart(part)) {
        return <AssistantToolPart part={part} />;
      }

      return null;
    }
  }
};
