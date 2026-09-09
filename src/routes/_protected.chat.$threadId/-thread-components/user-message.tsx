import { createStaticEditor, PlateStatic } from "platejs/static";
import { useMemo } from "react";

import { useClampHeight } from "@/hooks/use-clamp-height";
import { markdownToStaticPlate } from "@/lib/plate";
import { threadStaticEditorPlugins } from "@/routes/_protected.chat.$threadId/-thread-components/composer/plate";
import {
  ComposerWrapper,
  ThreadComposer,
} from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

import { useChatStore } from "../../-chat-store";

type UserMessageProps = {
  message: ThreadUIMessage;
};

type UserMessageContentProps = {
  markdown: string;
};

export const UserMessage = ({ message }: UserMessageProps) => {
  const editingState = useChatStore((state) => state.editingState);
  const setEditingState = useChatStore((state) => state.setEditingState);
  const markdown = message.parts.find((part) => part.type === "text")?.text ?? "";
  const isEditing = editingState?.messageId === message.id;

  if (isEditing) {
    return <ThreadComposer location="edit" />;
  }

  return (
    <ComposerWrapper
      className="relative block w-full overflow-clip bg-input/50 text-left transition-colors hover:border-ring/50"
      onClick={() => {
        setEditingState({
          messageId: message.id,
          markdown,
        });
      }}
      render={<button type="button" />}
    >
      <UserMessageContent markdown={markdown} />
    </ComposerWrapper>
  );
};

const UserMessageContent = ({ markdown }: UserMessageContentProps) => {
  const { isHeightClamped, lineHeight, maxHeight, ref } = useClampHeight<HTMLDivElement>();
  const editor = useMemo(
    () =>
      createStaticEditor({
        plugins: threadStaticEditorPlugins,
        value: (plate) => markdownToStaticPlate(plate, markdown),
      }),
    [markdown],
  );

  return (
    <>
      <div
        className="overflow-hidden p-1"
        data-test-id="user-message-clamp"
        ref={ref}
        style={{ lineHeight }}
      >
        <div data-test-id="user-message-clamp-content" style={{ maxHeight }}>
          <PlateStatic
            className="wrap-break-word whitespace-pre-wrap outline-none"
            editor={editor}
          />
        </div>
      </div>
      {isHeightClamped && (
        <span className="pointer-events-none absolute right-0 bottom-0 left-0 h-1/4 bg-linear-to-t from-secondary from-10% to-transparent" />
      )}
    </>
  );
};
