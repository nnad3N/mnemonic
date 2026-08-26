import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { convertFileListToFileUIParts } from "ai";
import { produce } from "immer";
import type { Descendant } from "platejs";
import { ElementApi, TextApi } from "platejs";
import type { PlateEditor } from "platejs/react";
import { useEditorRef, useEditorSelector } from "platejs/react";

import { useMessageScroller } from "@/components/ui/message-scroller";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";

import { threadMutations } from "../-thread-api/thread-run.functions";
import { getThreadEditorId, plateToMarkdown } from "../-thread-components/composer/plate";
import type { ThreadMetadataAttachment, ThreadUIMessage } from "../-thread-types";
import type { ThreadInputLocation } from "../../-chat-store";
import { useChatStore } from "../../-chat-store";
import { threadQueries, useThreadChat } from "./use-thread-chat";

const Route = getRouteApi("/_protected/chat/$threadId");

type MoveSidebarThreadToTopInput = {
  threadId: string;
  topicId: string | undefined;
};

const moveSidebarThreadToTop = (queryClient: QueryClient, input: MoveSidebarThreadToTopInput) => {
  const updatedAt = Temporal.Now.instant().toString();

  queryClient.setQueryData(sidebarQueries.threads(input.topicId).queryKey, (current) =>
    produce(current, (draft) => {
      if (!draft) return;

      const threadIndex = draft.findIndex((thread) => thread.id === input.threadId);

      if (threadIndex === -1) return;

      const [thread] = draft.splice(threadIndex, 1);
      thread.updatedAt = updatedAt;
      draft.unshift(thread);
    }),
  );
};

export const hasComposerContent = (editor: PlateEditor, node: Descendant): boolean => {
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

export const useIsComposerEmpty = (editorId?: string): boolean =>
  useEditorSelector(
    (plate) => {
      // useEditorSelector types `editor` as always defined, but under
      // PlateController with no mounted Plate for this id, the fallback store
      // has no editor set. useEditorRef coalesces with createPlateFallbackEditor();
      // useEditorSelector does not — it passes the raw store value, which can be
      // undefined until a real editor mounts.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (plate === undefined || plate.meta.isFallback) {
        return true;
      }

      return !plate.children.some((node) => hasComposerContent(plate, node));
    },
    [],
    { id: editorId },
  );

export const getComposerAttachments = async (
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

  if (editedMessage?.metadata?.type === "user" && editedMessage.metadata.attachments) {
    attachments.push(...editedMessage.metadata.attachments);
  }

  const draftFiles: File[] = [];

  for (const attachment of storedAttachments.get(threadId) ?? []) {
    if (attachment.status === "draft" && attachment.location === location) {
      draftFiles.push(attachment.file);
      attachments.push({
        filename: attachment.filename,
        mediaType: attachment.file.type,
        sha256: attachment.sha256,
      });
    }
  }

  if (draftFiles.length > 0) {
    const dataTransfer = new DataTransfer();

    for (const file of draftFiles) {
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
  const isEditorEmpty = useIsComposerEmpty(editorId);

  const chat = useThreadChat();
  const queryClient = useQueryClient();
  const { scrollToEnd } = useMessageScroller();
  const { data: topicId } = useSuspenseQuery({
    ...threadQueries.chat(threadId),
    select: (data) => data.topicId,
  });
  const createThreadTitle = useMutation(threadMutations.createTitle());
  const stopRun = useMutation(threadMutations.stop());
  const editingState = useChatStore((state) => state.editingState);
  const setEditingState = useChatStore((state) => state.setEditingState);
  const removeAttachment = useChatStore((state) => state.removeAttachment);

  const canSend =
    !editor.meta.isFallback &&
    !isEditorEmpty &&
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
      const messageIndex = chat.messages.findIndex(
        (message) => message.id === editingState.messageId,
      );
      useChatStore.getState().hydrateAttachments(threadId, chat.messages.slice(0, messageIndex));
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
      createThreadTitle.mutate({
        text,
        threadId,
        topicId,
      });
    }

    scrollToEnd({ behavior: "smooth" });

    moveSidebarThreadToTop(queryClient, { threadId, topicId });

    await chat.sendMessage({
      text,
      files,
      metadata: {
        type: "user",
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
    chat.setMessages((messages) =>
      produce(messages, (draft) => {
        const last = draft.findLast((message) => message.role === "assistant");
        const work =
          last?.metadata?.type === "assistant" ? last.metadata.workTimings?.at(-1) : undefined;

        if (work) {
          work.endedAt ??= Temporal.Now.instant().toString();
        }
      }),
    );

    await chat.stop();
    stopRun.mutate(threadId);

    const lastMessage = chat.messages.at(-1);

    if (
      lastMessage?.role === "assistant" &&
      lastMessage.parts.some((part) => part.type === "text")
    ) {
      return;
    }

    const message = chat.messages.findLast((message) => message.role === "user");
    if (!message) return;

    setEditingState({
      messageId: message.id,
      markdown: message.parts.find((part) => part.type === "text")?.text ?? "",
    });
  };

  return {
    canSend,
    cancelEditing,
    sendMessage,
    stopStream,
  };
};
