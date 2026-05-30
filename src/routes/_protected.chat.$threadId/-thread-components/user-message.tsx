import { Streamdown } from "streamdown";

import { useClampHeight } from "@/hooks/use-clamp-height";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

import { useThreadStore } from "../-thread-store";

type UserMessageProps = {
  message: ThreadUIMessage;
  index: number;
};

type UserMessageContentProps = {
  markdown: string;
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
      className="relative block w-full cursor-pointer overflow-clip rounded-2xl border bg-secondary px-3 py-2.5 text-left text-base transition-colors hover:border-ring md:text-sm"
      onClick={() => {
        setEditingState({
          messageId: message.id,
          messageIndex: index,
          markdown,
        });
      }}
      type="button"
    >
      <UserMessageContent markdown={markdown} />
    </button>
  );
};

const UserMessageContent = ({ markdown }: UserMessageContentProps) => {
  const { isHeightClamped, lineHeight, maxHeight, ref } =
    useClampHeight<HTMLDivElement>();

  return (
    <>
      <div
        className="overflow-hidden"
        ref={ref}
        style={{
          lineHeight,
          maxHeight,
        }}
      >
        <Streamdown className="whitespace-pre-line" mode="static">
          {markdown}
        </Streamdown>
      </div>
      {isHeightClamped && (
        <span className="pointer-events-none absolute right-0 bottom-0 left-0 h-1/4 bg-linear-to-t from-secondary from-10% to-transparent" />
      )}
    </>
  );
};
