import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { createStaticEditor, PlateStatic } from "platejs/static";
import { useMemo } from "react";

import { useClampHeight } from "@/hooks/use-clamp-height";
import { threadQuery } from "@/routes/_protected.chat.$threadId/-thread-api/get-thread";
import {
  getThreadStaticEditorPlugins,
  markdownToStaticPlate,
} from "@/routes/_protected.chat.$threadId/-thread-components/composer/plate";
import {
  ComposerWrapper,
  ThreadComposer,
} from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
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
    <ComposerWrapper
      className="relative block w-full overflow-clip bg-secondary text-left transition-colors hover:border-ring"
      onClick={() => {
        setEditingState({
          messageId: message.id,
          messageIndex: index,
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
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const topicId = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  }).data;
  const { isHeightClamped, maxHeight, ref } = useClampHeight<HTMLDivElement>({
    // text-sm line-height
    lineHeight: 1.25 / 0.875,
  });

  const editor = useMemo(
    () =>
      createStaticEditor({
        plugins: getThreadStaticEditorPlugins(topicId),
        value: (plate) => markdownToStaticPlate(plate, markdown),
      }),
    [markdown, topicId]
  );

  return (
    <>
      <div className="overflow-hidden p-1" ref={ref}>
        <PlateStatic
          style={{
            maxHeight,
          }}
          className="wrap-break-word whitespace-pre-wrap outline-none"
          editor={editor}
        />
      </div>
      {isHeightClamped && (
        <span className="pointer-events-none absolute right-0 bottom-0 left-0 h-1/4 bg-linear-to-t from-secondary from-10% to-transparent" />
      )}
    </>
  );
};
