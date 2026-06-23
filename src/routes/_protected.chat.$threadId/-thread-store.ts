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
  pollingTopicId: string | null;
};

type Actions = {
  setEditingState: (data: EditingState | null) => void;
  setPollingTopicId: (topicId: string | null) => void;
};

export const useThreadStore = create<State & Actions>()(
  immer((set) => ({
    editingState: null,
    pollingTopicId: null,
    setEditingState: (data) => {
      set((state) => {
        state.editingState = data;
      });
    },
    setPollingTopicId: (topicId) => {
      set({
        pollingTopicId: topicId,
      });
    },
  }))
);
