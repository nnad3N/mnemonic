import type { Value } from "platejs";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { ThreadUIMessage } from "./_protected.chat.$threadId/-thread-types";

type ThreadId = string;
type TopicId = string;

export type ThreadInputLocation = "main" | "edit";

export type ThreadAttachment =
  | {
      status: "ready" | "pending" | "failed";
      location: ThreadInputLocation;
      filename: string;
      sha256: string;
      file: File;
    }
  | {
      status: "persisted";
      location?: never;
      filename: string;
      sha256: string;
    };

type ComposerState = {
  value: Value;
};

type EditingState = {
  messageId: string;
  messageIndex: number;
  markdown: string;
};

type State = {
  composerState: Map<ThreadId, ComposerState>;
  editingState: EditingState | null;
  attachments: Map<ThreadId, ThreadAttachment[]>;
  pollingTopicIds: Set<TopicId>;
};

type Actions = {
  setEditingState: (data: EditingState | null) => void;
  setComposerValue: (threadId: ThreadId, value: Value) => void;
  upsertAttachment: (
    threadId: ThreadId,
    attachment: Exclude<ThreadAttachment, { status: "persisted" }>
  ) => void;
  removeAttachment: (threadId: ThreadId, sha256: string) => void;
  hydrateAttachments: (threadId: ThreadId, messages: ThreadUIMessage[]) => void;
  removeComposerState: (threadId: ThreadId) => void;
  addPollingTopicId: (topicId: TopicId) => void;
  removePollingTopicId: (topicId: TopicId) => void;
};

export const useChatStore = create<State & Actions>()(
  immer((set) => ({
    composerState: new Map(),
    editingState: null,
    attachments: new Map(),
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
          });
          return;
        }

        composerState.value = value;
      });
    },
    upsertAttachment: (threadId, attachment) => {
      set((state) => {
        const attachments = state.attachments.get(threadId);

        if (!attachments) {
          state.attachments.set(threadId, [attachment]);
          return;
        }

        const attachmentIndex = attachments.findIndex(
          (a) => a.sha256 === attachment.sha256
        );

        if (attachmentIndex === -1) {
          attachments.push(attachment);
        } else {
          attachments[attachmentIndex] = attachment;
        }
      });
    },
    removeAttachment: (threadId, sha256) => {
      set((state) => {
        const attachments = state.attachments.get(threadId);
        const attachmentIndex =
          attachments?.findIndex((a) => a.sha256 === sha256) ?? -1;

        if (attachmentIndex === -1) {
          return;
        }

        if (attachments?.[attachmentIndex].status === "persisted") {
          return;
        }

        attachments?.splice(attachmentIndex, 1);
      });
    },
    hydrateAttachments: (threadId, messages) => {
      set((state) => {
        const attachments: ThreadAttachment[] = [];

        for (const message of messages) {
          for (const attachment of message.metadata?.attachments ?? []) {
            attachments.push({
              status: "persisted",
              filename: attachment.filename,
              sha256: attachment.sha256,
            });
          }
        }

        const storedAttachments = state.attachments.get(threadId) ?? [];

        for (const attachment of storedAttachments) {
          // Skip persisted attachments, some may be orphaned after editing a message
          if (attachment.status === "persisted") {
            continue;
          }

          const isPersisted = attachments.some(
            (a) => a.sha256 === attachment.sha256
          );

          if (!isPersisted) {
            attachments.push(attachment);
          }
        }

        state.attachments.set(threadId, attachments);
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
