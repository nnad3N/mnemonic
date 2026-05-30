import type { UIMessage, UIDataTypes, UIMessagePart, UITools } from "ai";

type AssistantMessageProps = {
  message: UIMessage;
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
    case "dynamic-tool": {
      throw new Error('Not implemented yet: "dynamic-tool" case');
    }
    case "file": {
      throw new Error('Not implemented yet: "file" case');
    }
    case "reasoning": {
      throw new Error('Not implemented yet: "reasoning" case');
    }
    case "source-document": {
      throw new Error('Not implemented yet: "source-document" case');
    }
    case "source-url": {
      throw new Error('Not implemented yet: "source-url" case');
    }
    case "step-start": {
      throw new Error('Not implemented yet: "step-start" case');
    }
    default: {
      return null;
    }
  }
};
