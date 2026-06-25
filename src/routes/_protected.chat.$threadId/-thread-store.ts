import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ThreadInputLocation = "main" | "edit";

type EditingState = {
  messageId: string;
  messageIndex: number;
  markdown: string;
};

type State = {
  editingState: EditingState | null;
  pollingTopicIds: Set<string>;
};

type Actions = {
  setEditingState: (data: EditingState | null) => void;
  addPollingTopicId: (topicId: string) => void;
  removePollingTopicId: (topicId: string) => void;
};

export const useThreadStore = create<State & Actions>()(
  immer((set) => ({
    editingState: null,
    pollingTopicIds: new Set(),
    setEditingState: (data) => {
      set((state) => {
        state.editingState = data;
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
