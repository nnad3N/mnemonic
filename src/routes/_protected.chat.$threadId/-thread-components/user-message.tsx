import type { UIMessage } from "@ai-sdk/react";

import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";

import { useThreadStore } from "../-thread-store";

type UserMessageProps = {
  message: UIMessage;
  index: number;
};

export const UserMessage = ({ message, index }: UserMessageProps) => {
  const editingState = useThreadStore((state) => state.editingState);
  const setEditingState = useThreadStore((state) => state.setEditingState);
  const markdown =
    message.parts.find((part) => part.type === "text")?.text ?? "";
  const isEditing = editingState?.messageId === message.id;

  if (isEditing) {
    return <ThreadComposer location="edit" />;
  }

  return (
    <button
      className="block w-full cursor-pointer rounded-2xl border bg-secondary px-2.5 py-1 text-left text-base transition-colors hover:border-ring md:text-sm"
      onClick={() => {
        setEditingState({
          messageId: message.id,
          messageIndex: index,
          markdown,
        });
      }}
      type="button"
    >
      {markdown}
    </button>
  );
};
