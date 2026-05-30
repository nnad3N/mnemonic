import type { UIMessage } from "@ai-sdk/react";

type UserMessageProps = {
  message: UIMessage;
};

export const UserMessage = ({ message }: UserMessageProps) => {
  const text = message.parts.find((part) => part.type === "text")?.text;

  return <div>{text}</div>;
};
