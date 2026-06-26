import type { Value } from "platejs";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ThreadInputLocation = "main" | "edit";

type ComposerState = {
  value: Value;
};

type EditingState = {
  messageId: string;
  messageIndex: number;
  markdown: string;
};

type State = {
  persistedComposerState: Map<string, ComposerState>;
  editingState: EditingState | null;
  pollingTopicIds: Set<string>;
};

type Actions = {
  setEditingState: (data: EditingState | null) => void;
  setPersistedComposerState: (threadId: string, value: Value) => void;
  removePersistedComposerState: (threadId: string) => void;
  addPollingTopicId: (topicId: string) => void;
  removePollingTopicId: (topicId: string) => void;
};

export const useChatStore = create<State & Actions>()(
  immer((set) => ({
    persistedComposerState: new Map(),
    editingState: null,
    pollingTopicIds: new Set(),
    setEditingState: (data) => {
      set((state) => {
        state.editingState = data;
      });
    },
    setPersistedComposerState: (threadId, value) => {
      set((state) => {
        state.persistedComposerState.set(threadId, { value });
      });
    },
    removePersistedComposerState: (threadId) => {
      set((state) => {
        state.persistedComposerState.delete(threadId);
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
