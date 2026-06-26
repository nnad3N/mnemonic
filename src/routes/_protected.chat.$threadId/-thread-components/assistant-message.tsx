import type { FileUIPart, SourceDocumentUIPart, SourceUrlUIPart } from "ai";
import { isToolUIPart } from "ai";
import { FileIcon, FileTextIcon, LinkIcon } from "lucide-react";
import { createMathPlugin } from "@streamdown/math";
import { Streamdown } from "streamdown";

const streamdownPlugins = {
  math: createMathPlugin({ singleDollarTextMath: true }),
};

import { isWebSearchAgentToolPart } from "@/lib/ai-sdk/tool-parts";
import { AssistantReasoningPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-reasoning-part";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";
import type {
  ThreadUIMessage,
  ThreadUIMessagePart,
} from "@/routes/_protected.chat.$threadId/-thread-types";

import { WebSearchAgentCard } from "./web-search-agent-card";

type AssistantMessageProps = {
  isAnimating?: boolean;
  message: ThreadUIMessage;
};

export const AssistantMessage = ({
  isAnimating = false,
  message,
}: AssistantMessageProps) => {
  return (
    <div className="flex flex-col gap-1">
      {message.parts.map((part, i) => (
        <AssistantMessagePart
          isAnimating={isAnimating}
          key={`${part.type}-${i}`}
          part={part}
        />
      ))}
    </div>
  );
};

type AssistantMessagePartProps = {
  isAnimating: boolean;
  part: ThreadUIMessagePart;
};

const AssistantMessagePart = ({
  isAnimating,
  part,
}: AssistantMessagePartProps) => {
  if (isWebSearchAgentToolPart(part)) {
    return <WebSearchAgentCard part={part} />;
  }

  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (part.type) {
    case "text": {
      return (
        <Streamdown isAnimating={isAnimating} plugins={streamdownPlugins}>
          {part.text}
        </Streamdown>
      );
    }
    case "reasoning": {
      return <AssistantReasoningPart part={part} />;
    }
    case "file": {
      return <FilePart part={part} />;
    }
    case "source-url": {
      return <SourceUrlPart part={part} />;
    }
    case "source-document": {
      return <SourceDocumentPart part={part} />;
    }
    default: {
      if (isToolUIPart(part)) {
        return <AssistantToolPart part={part} />;
      }

      return null;
    }
  }
};

type FilePartProps = {
  part: FileUIPart;
};

const FilePart = ({ part }: FilePartProps) => (
  <ThreadMetaLine>
    <FileIcon className="size-4 shrink-0" />
    {part.filename ?? part.mediaType}
  </ThreadMetaLine>
);

type SourceUrlPartProps = {
  part: SourceUrlUIPart;
};

const SourceUrlPart = ({ part }: SourceUrlPartProps) => (
  <ThreadMetaLine>
    <LinkIcon className="size-4 shrink-0" />
    <a href={part.url} rel="noopener" target="_blank">
      {part.title ?? part.url}
    </a>
  </ThreadMetaLine>
);

type SourceDocumentPartProps = {
  part: SourceDocumentUIPart;
};

const SourceDocumentPart = ({ part }: SourceDocumentPartProps) => (
  <ThreadMetaLine>
    <FileTextIcon className="size-4 shrink-0" />
    {part.title}
  </ThreadMetaLine>
);
