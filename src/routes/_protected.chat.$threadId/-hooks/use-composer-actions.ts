import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { convertFileListToFileUIParts } from "ai";
import type { Descendant } from "platejs";
import { ElementApi, TextApi } from "platejs";
import type { PlateEditor } from "platejs/react";
import { useEditorRef, useEditorSelector } from "platejs/react";

import { threadQuery } from "../-thread-api/get-thread";
import { useThreadChat } from "../-thread-chat-provider";
import { getThreadEditorId, plateToMarkdown } from "../-thread-components/composer/plate";
import type { ThreadMetadataAttachment, ThreadUIMessage } from "../-thread-types";
import type { ThreadInputLocation } from "../../-chat-store";
import { useChatStore } from "../../-chat-store";
import { useCreateThreadTitle } from "./use-create-thread-title";

const Route = getRouteApi("/_protected/chat/$threadId");

const hasComposerContent = (editor: PlateEditor, node: Descendant): boolean => {
  // editor.api.isEmpty() treats whitespace text as content. We need whitespace
  // to stay empty, while void nodes still count because they render visible
  // chips with empty text children.
  if (TextApi.isText(node)) {
    return node.text.trim().length > 0;
  }

  if (!ElementApi.isElement(node)) {
    return false;
  }

  if (editor.api.isVoid(node)) {
    return true;
  }

  return node.children.some((child) => hasComposerContent(editor, child));
};

const getComposerAttachments = async (
  threadId: string,
  messages: ThreadUIMessage[],
  location: ThreadInputLocation,
) => {
  const { attachments: storedAttachments, editingState } = useChatStore.getState();
  const editedMessage = editingState
    ? messages.find((message) => message.id === editingState.messageId)
    : undefined;

  const files = editedMessage?.parts.filter((part) => part.type === "file") ?? [];
  const attachments: ThreadMetadataAttachment[] = [];

  for (const attachment of editedMessage?.metadata?.attachments ?? []) {
    attachments.push(attachment);
  }

  const readyFiles: File[] = [];

  for (const attachment of storedAttachments.get(threadId) ?? []) {
    if (attachment.location === location && attachment.status === "ready") {
      readyFiles.push(attachment.file);
      attachments.push({
        filename: attachment.filename,
        mediaType: attachment.file.type,
        sha256: attachment.sha256,
      });
    }
  }

  if (readyFiles.length > 0) {
    const dataTransfer = new DataTransfer();

    for (const file of readyFiles) {
      dataTransfer.items.add(file);
    }

    for (const filePart of await convertFileListToFileUIParts(dataTransfer.files)) {
      files.push(filePart);
    }
  }

  return {
    files,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
};

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

      return !plate.children.some((node) => hasComposerContent(plate, node));
    },
    [],
    { id: editorId },
  );

  const chat = useThreadChat();
  const { data: topicId } = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  });
  const createThreadTitleMutation = useCreateThreadTitle();
  const editingState = useChatStore((state) => state.editingState);
  const setEditingState = useChatStore((state) => state.setEditingState);
  const removeAttachment = useChatStore((state) => state.removeAttachment);
  const hasBlockingAttachments = useChatStore(
    (state) =>
      state.attachments
        .get(threadId)
        ?.some(
          (attachment) =>
            (attachment.status === "pending" || attachment.status === "failed") &&
            attachment.location === location,
        ) ?? false,
  );

  const canSend =
    !editor.meta.isFallback &&
    !isEditorEmpty &&
    !hasBlockingAttachments &&
    chat.status !== "submitted" &&
    chat.status !== "streaming";

  const sendMessage = async () => {
    if (!canSend) return;

    const text = plateToMarkdown(editor).trim();
    const { files, attachments } = await getComposerAttachments(threadId, chat.messages, location);

    if (location === "main") {
      useChatStore.getState().removeComposerState(threadId);
    }
    if (location === "edit" && editingState) {
      useChatStore
        .getState()
        .hydrateAttachments(threadId, chat.messages.slice(0, editingState.messageIndex));
    }
    if (location === "edit") {
      setEditingState(null);
    }

    for (const attachment of attachments ?? []) {
      useChatStore.getState().upsertAttachment(threadId, {
        status: "persisted",
        filename: attachment.filename,
        sha256: attachment.sha256,
      });
    }

    editor.tf.setValue();
    editor.tf.focus({ edge: "endEditor" });

    if (chat.messages.length < 2) {
      createThreadTitleMutation.mutate({
        text,
        threadId,
        topicId,
      });
    }

    await chat.sendMessage({
      text,
      files,
      metadata: {
        attachments,
      },
      messageId: location === "edit" ? editingState?.messageId : undefined,
    });
  };

  const cancelEditing = () => {
    setEditingState(null);

    const attachments = useChatStore.getState().attachments.get(threadId) ?? [];

    for (const attachment of attachments) {
      if (attachment.location === "edit") {
        removeAttachment(threadId, attachment.sha256);
      }
    }
  };

  const stopStream = async () => {
    await chat.stop();

    const lastMessage = chat.messages.at(-1);

    if (
      lastMessage?.role === "assistant" &&
      lastMessage.parts.some((part) => part.type === "text")
    ) {
      return;
    }

    const messageIndex = chat.messages.findLastIndex((message) => message.role === "user");
    if (messageIndex === -1) return;

    const message = chat.messages[messageIndex];

    setEditingState({
      messageId: message.id,
      messageIndex,
      markdown: message.parts.find((part) => part.type === "text")?.text ?? "",
    });
  };

  return {
    canSend,
    cancelEditing,
    isEditorEmpty,
    sendMessage,
    stopStream,
  };
};
