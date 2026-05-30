import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ThreadInputLocation = "main" | "edit";

type EditingState = {
  messageId: string;
  files: File[];
};

type State = {
  editingState: EditingState | null;
};

type Actions = {
  setEditingState: (data: EditingState) => void;
  clearEditingState: () => void;
};

export const useThreadStore = create<State & Actions>()(
  immer((set) => ({
    editingState: null,
    setEditingState: (data) => {
      set((state) => {
        state.editingState = data;
      });
    },
    clearEditingState: () => {
      set((state) => {
        state.editingState = null;
      });
    },
  }))
);
