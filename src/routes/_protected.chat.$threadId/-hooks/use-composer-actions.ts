import { getRouteApi } from "@tanstack/react-router";
import { convertFileListToFileUIParts } from "ai";
import { ElementApi, TextApi } from "platejs";
import type { Descendant } from "platejs";
import type { PlateEditor } from "platejs/react";
import { useEditorRef, useEditorSelector } from "platejs/react";

import { useCreateThreadTitle } from "../-thread-api/create-thread-title";
import { useThreadChat } from "../-thread-chat-provider";
import {
  getThreadEditorId,
  plateToMarkdown,
} from "../-thread-components/composer/plate";
import type { ThreadMetadataAttachment } from "../-thread-types";
import type { ThreadInputLocation } from "../../-chat-store";
import { useChatStore } from "../../-chat-store";

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

const getThreadAttachments = async (
  threadId: string,
  location: ThreadInputLocation
) => {
  const attachments = useChatStore.getState().attachments.get(threadId);

  if (!attachments) {
    return {
      files: undefined,
      metadataAttachments: undefined,
    };
  }

  const files: File[] = [];
  const metadataAttachments: ThreadMetadataAttachment[] = [];

  for (const attachment of attachments) {
    if (attachment.location === location && attachment.status === "ready") {
      files.push(attachment.file);
      metadataAttachments.push({
        filename: attachment.filename,
        mediaType: attachment.file.type,
        sha256: attachment.sha256,
      });
    }
  }

  const dataTransfer = new DataTransfer();

  for (const file of files) {
    dataTransfer.items.add(file);
  }

  const fileParts = await convertFileListToFileUIParts(dataTransfer.files);

  return {
    metadataAttachments,
    files: fileParts,
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
    { id: editorId }
  );

  const chat = useThreadChat();
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
            (attachment.status === "pending" ||
              attachment.status === "failed") &&
            attachment.location === location
        ) ?? false
  );

  const canSend =
    !editor.meta.isFallback &&
    !isEditorEmpty &&
    !hasBlockingAttachments &&
    chat.status !== "submitted" &&
    chat.status !== "streaming";

  const sendMessage = async () => {
    if (!canSend) {
      return;
    }

    const text = plateToMarkdown(editor).trim();

    if (location === "main") {
      useChatStore.getState().removeComposerState(threadId);
    }
    if (location === "edit" && editingState) {
      useChatStore
        .getState()
        .hydrateAttachments(
          threadId,
          chat.messages.slice(0, editingState.messageIndex)
        );
    }
    if (location === "edit") {
      setEditingState(null);
    }

    editor.tf.setValue();
    editor.tf.focus({ edge: "endEditor" });

    if (chat.messages.length < 2) {
      createThreadTitleMutation.mutate({ text, threadId });
    }

    const { files, metadataAttachments } = await getThreadAttachments(
      threadId,
      location
    );

    await chat.sendMessage({
      text,
      files,
      metadata: {
        attachments: metadataAttachments,
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
