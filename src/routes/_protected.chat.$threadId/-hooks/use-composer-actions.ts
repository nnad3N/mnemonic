import { getRouteApi } from "@tanstack/react-router";
import { useEditorRef, useEditorSelector } from "platejs/react";

import {
  getThreadEditorId,
  markdownToPlateValue,
  plateValueToMarkdown,
} from "../-thread-components/composer/plate";
import type { ThreadInputLocation } from "../-thread-store";
import { useThreadStore } from "../-thread-store";
import { useThreadChat } from "./use-thread-chat";

const Route = getRouteApi("/_protected/chat/$threadId");

export const useComposerActions = (location: ThreadInputLocation) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const isEditorEmpty = useEditorSelector(
    (plate) => {
      if (plate === undefined || plate.meta.isFallback) {
        return true;
      }

      return plate.api.string([]).trim() === "";
    },
    [],
    { id: editorId }
  );

  const chat = useThreadChat();
  const editingState = useThreadStore((state) => state.editingState);
  const setEditingState = useThreadStore((state) => state.setEditingState);

  const canSend =
    !editor.meta.isFallback &&
    !isEditorEmpty &&
    chat.status !== "submitted" &&
    chat.status !== "streaming";

  const sendMessage = async () => {
    if (!canSend) {
      return;
    }

    const text = plateValueToMarkdown(editor).trim();

    if (location === "edit") {
      setEditingState(null);
    }
    editor.tf.setValue(markdownToPlateValue(editor, ""));

    await chat.sendMessage({
      text,
      messageId: location === "edit" ? editingState?.messageId : undefined,
    });
  };

  const cancelEditing = () => {
    setEditingState(null);
  };

  const stopStream = async () => {
    if (chat.status !== "streaming") {
      return;
    }

    await chat.stop();
  };

  return {
    canSend,
    cancelEditing,
    isEditorEmpty,
    sendMessage,
    stopStream,
  };
};
