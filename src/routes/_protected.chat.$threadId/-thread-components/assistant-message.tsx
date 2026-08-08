import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { isToolUIPart } from "ai";
import { useTheme } from "next-themes";
import { Fragment } from "react";
import { Streamdown } from "streamdown";

import { groupAssistantParts } from "@/lib/ai-sdk/work-part";
import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";
import { MessageStateContext } from "@/routes/_protected.chat.$threadId/-message-state-context";
import { AssistantReasoningPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-reasoning-part";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { ExecuteCodePart } from "@/routes/_protected.chat.$threadId/-thread-components/execute-code-part.tsx";
import { OmPart } from "@/routes/_protected.chat.$threadId/-thread-components/om-part";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import { WebFetchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-fetch-part";
import { WebSearchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-search-part";
import { WorkedForIndicator } from "@/routes/_protected.chat.$threadId/-thread-components/worked-for-indicator";
import type {
  ThreadUIMessage,
  ThreadUIMessagePart,
} from "@/routes/_protected.chat.$threadId/-thread-types";

const WORK_RUN_COLLAPSE_THRESHOLD = 3;

const streamdownPlugins = {
  code: createCodePlugin(),
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid: createMermaidPlugin(),
};

type AssistantMessageProps = {
  isStreaming: boolean;
  message: ThreadUIMessage;
};

export const AssistantMessage = ({ isStreaming, message }: AssistantMessageProps) => {
  const blocks = groupAssistantParts(message.parts);

  return (
    <MessageStateContext.Provider value={{ isStreaming }}>
      <div className="flex flex-col gap-2 px-2">
        {blocks.map((block) => {
          if (block.type === "text") {
            return (
              <AssistantMessagePart key={block.id} messageParts={message.parts} part={block.part} />
            );
          }

          if (block.visibleCount >= WORK_RUN_COLLAPSE_THRESHOLD) {
            return (
              <WorkedForIndicator key={block.id} parts={block.parts}>
                {block.parts.map((part, offset) => (
                  <AssistantMessagePart
                    key={`${part.type}-${block.startIndex + offset}`}
                    messageParts={message.parts}
                    part={part}
                  />
                ))}
              </WorkedForIndicator>
            );
          }

          return (
            <Fragment key={block.id}>
              {block.parts.map((part, offset) => (
                <AssistantMessagePart
                  key={`${part.type}-${block.startIndex + offset}`}
                  messageParts={message.parts}
                  part={part}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
    </MessageStateContext.Provider>
  );
};

type AssistantMessagePartProps = {
  messageParts: ThreadUIMessagePart[];
  part: ThreadUIMessagePart;
};

const AssistantMessagePart = ({ messageParts, part }: AssistantMessagePartProps) => {
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
      return <OmPart messageParts={messageParts} part={part} />;
    }

    default: {
      if (isToolUIPart(part)) {
        return <AssistantToolPart part={part} />;
      }

      return null;
    }
  }
};
