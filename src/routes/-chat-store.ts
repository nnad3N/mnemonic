import type { Value } from "platejs";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ThreadInputLocation = "main" | "edit";

export type ComposerAttachment = {
  id: string;
  sha256: string;
  status: "ready" | "pending" | "failed";
  file: File;
};

type ComposerState = {
  value: Value;
  attachments: ComposerAttachment[];
};

type EditingState = {
  messageId: string;
  messageIndex: number;
  markdown: string;
};

type State = {
  composerState: Map<string, ComposerState>;
  editingState: EditingState | null;
  pollingTopicIds: Set<string>;
};

type Actions = {
  setEditingState: (data: EditingState | null) => void;
  setComposerValue: (threadId: string, value: Value) => void;
  setComposerAttachment: (
    threadId: string,
    attachment: ComposerAttachment
  ) => void;
  removeComposerAttachment: (threadId: string, attachmentId: string) => void;
  removeComposerState: (threadId: string) => void;
  addPollingTopicId: (topicId: string) => void;
  removePollingTopicId: (topicId: string) => void;
};

export const useChatStore = create<State & Actions>()(
  immer((set) => ({
    composerState: new Map(),
    editingState: null,
    pollingTopicIds: new Set(),
    setEditingState: (data) => {
      set((state) => {
        state.editingState = data;
      });
    },
    setComposerValue: (threadId, value) => {
      set((state) => {
        const composerState = state.composerState.get(threadId);

        if (!composerState) {
          state.composerState.set(threadId, {
            value,
            attachments: [],
          });
          return;
        }

        composerState.value = value;
      });
    },
    setComposerAttachment: (threadId, attachment) => {
      set((state) => {
        const composerState = state.composerState.get(threadId);

        if (!composerState) {
          state.composerState.set(threadId, {
            value: [],
            attachments: [attachment],
          });
          return;
        }

        const existingAttachmentIndex = composerState.attachments.findIndex(
          (a) => a.sha256 === attachment.sha256
        );

        if (existingAttachmentIndex === -1) {
          composerState.attachments.push(attachment);
        } else {
          composerState.attachments[existingAttachmentIndex] = attachment;
        }
      });
    },
    removeComposerAttachment: (threadId, attachmentId) => {
      set((state) => {
        const composerState = state.composerState.get(threadId);

        if (!composerState) {
          return;
        }

        composerState.attachments = composerState.attachments.filter(
          (a) => a.id !== attachmentId
        );
      });
    },
    removeComposerState: (threadId) => {
      set((state) => {
        state.composerState.delete(threadId);
      });
    },
    addPollingTopicId: (topicId) => {
      set((state) => {
        state.pollingTopicIds.add(topicId);
      });
    },
    removePollingTopicId: (topicId) => {
      set((state) => {
        state.pollingTopicIds.delete(topicId);
      });
    },
  }))
);
