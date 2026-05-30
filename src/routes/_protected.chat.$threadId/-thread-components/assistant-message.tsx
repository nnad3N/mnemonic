import type {
  FileUIPart,
  SourceDocumentUIPart,
  SourceUrlUIPart,
  UIDataTypes,
  UIMessagePart,
  UITools,
} from "ai";
import { FileIcon, FileTextIcon, LinkIcon } from "lucide-react";

import { AssistantReasoningPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-reasoning-part";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";

type AssistantMessageProps = {
  message: { parts: UIMessagePart<UIDataTypes, UITools>[] };
};

export const AssistantMessage = ({ message }: AssistantMessageProps) => {
  return message.parts.map((part, i) => (
    <AssistantMessagePart key={`${part.type}-${i}`} part={part} />
  ));
};

type AssistantMessagePartProps = {
  part: UIMessagePart<UIDataTypes, UITools>;
};

const AssistantMessagePart = ({ part }: AssistantMessagePartProps) => {
  switch (part.type) {
    case "text": {
      return <div>{part.text}</div>;
    }
    case "dynamic-tool":
    case "step-start": {
      return null;
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
