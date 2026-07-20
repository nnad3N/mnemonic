import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { isToolUIPart } from "ai";
import { useTheme } from "next-themes";
import { Streamdown } from "streamdown";

import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";
import { MessageStateContext } from "@/routes/_protected.chat.$threadId/-message-state-context";
import { AssistantReasoningPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-reasoning-part";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { ExecuteCodePart } from "@/routes/_protected.chat.$threadId/-thread-components/execute-code-part.tsx";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import { WebFetchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-fetch-part";
import { WebSearchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-search-part";
import type {
  ThreadUIMessage,
  ThreadUIMessagePart,
} from "@/routes/_protected.chat.$threadId/-thread-types";

const streamdownPlugins = {
  code: createCodePlugin(),
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid: createMermaidPlugin(),
};

type AssistantMessageProps = {
  isAnimating?: boolean;
  message: ThreadUIMessage;
};

export const AssistantMessage = ({ isAnimating = false, message }: AssistantMessageProps) => {
  return (
    <MessageStateContext.Provider value={{ isAnimating }}>
      <div className="flex flex-col gap-2">
        {message.parts.map((part, i) => (
          <AssistantMessagePart key={`${part.type}-${i}`} part={part} />
        ))}
      </div>
    </MessageStateContext.Provider>
  );
};

type AssistantMessagePartProps = {
  part: ThreadUIMessagePart;
};

const AssistantMessagePart = ({ part }: AssistantMessagePartProps) => {
  const { isAnimating } = useMessageState();
  const { resolvedTheme } = useTheme();

  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (part.type) {
    case "text": {
      return (
        <Streamdown
          isAnimating={isAnimating}
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

    default: {
      if (isToolUIPart(part)) {
        return <AssistantToolPart part={part} interactive={false} />;
      }

      return null;
    }
  }
};
