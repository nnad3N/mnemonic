import type { UIMessage } from "@ai-sdk/react";
import { getRouteApi } from "@tanstack/react-router";
import { useEditorRef } from "platejs/react";

import {
  getThreadEditorId,
  markdownToPlateValue,
} from "@/routes/_protected.chat.$threadId/-thread-components/composer/plate";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";

import { useThreadStore } from "../-thread-store";

type UserMessageProps = {
  message: UIMessage;
};

const Route = getRouteApi("/_protected/chat/$threadId");

export const UserMessage = ({ message }: UserMessageProps) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const editingState = useThreadStore((state) => state.editingState);
  const setEditingState = useThreadStore((state) => state.setEditingState);
  const editEditor = useEditorRef(getThreadEditorId(threadId, "edit"));
  const text = message.parts.find((part) => part.type === "text")?.text ?? "";
  const isEditing = editingState?.messageId === message.id;

  if (isEditing) {
    return <ThreadComposer location="edit" />;
  }

  return (
    <button
      className="block w-full cursor-pointer rounded-2xl bg-input/50 px-2.5 py-1 text-left text-base md:text-sm"
      onClick={() => {
        if (editEditor.meta.isFallback) {
          return;
        }

        editEditor.tf.setValue(markdownToPlateValue(editEditor, text));
        editEditor.tf.focus();
        setEditingState({ messageId: message.id, files: [] });
      }}
      type="button"
    >
      {text}
    </button>
  );
};
