import { panic } from "better-result";
import { use } from "react";
import { createStore } from "zustand/vanilla";

import { NoteBaselineContext } from "./note-baseline-context";

export type NoteBaselineSeed = {
  /** The latest user version saves write into; null while the editor sits on an agent version. */
  baseVersionId: string | null;
  contentHash: string;
};

export type NoteEditorBaseline = NoteBaselineSeed & {
  dirty: boolean;
  editSeq: number;
  suppressedReviewVersionId: string | null;
};

type NoteBaselineStore = NoteEditorBaseline & {
  allowReview: () => void;
  confirmSaved: (editSeq: number, saved: NoteBaselineSeed) => void;
  markEdited: (pendingReviewVersionId: string | null) => void;
  seedBaseline: (seed: NoteBaselineSeed) => void;
};

export const createNoteBaselineStore = (seed: NoteBaselineSeed) =>
  createStore<NoteBaselineStore>()((set) => ({
    ...seed,
    dirty: false,
    editSeq: 0,
    suppressedReviewVersionId: null,
    allowReview: () => set({ suppressedReviewVersionId: null }),
    confirmSaved: (editSeq, saved) =>
      set((state) => ({
        baseVersionId: saved.baseVersionId,
        contentHash: saved.contentHash,
        dirty: state.editSeq !== editSeq,
      })),
    markEdited: (pendingReviewVersionId) =>
      set((state) => ({
        dirty: true,
        editSeq: state.editSeq + 1,
        suppressedReviewVersionId: pendingReviewVersionId ?? state.suppressedReviewVersionId,
      })),
    seedBaseline: (seed) =>
      set({ ...seed, dirty: false, editSeq: 0, suppressedReviewVersionId: null }),
  }));

export const useNoteBaselineStore = () => {
  const store = use(NoteBaselineContext);

  if (!store) {
    panic("useNoteBaselineStore must be used within NoteBaselineContext.Provider");
  }

  return store;
};

export type NoteViewState =
  | { kind: "editor" }
  | { kind: "history"; baseVersionId: string }
  | { kind: "review"; baseVersionId: string };

export const resolveNoteView = (
  note: { pendingReviewBaseVersionId: string | null; versionId: string },
  baseline: NoteEditorBaseline,
  historyDiffId: string | undefined,
): NoteViewState => {
  if (historyDiffId) {
    return { baseVersionId: historyDiffId, kind: "history" };
  }

  if (!note.pendingReviewBaseVersionId) {
    return { kind: "editor" };
  }

  // Typing over a pending review keeps the editor; only the Review button opens that review.
  if (baseline.dirty) {
    return { kind: "editor" };
  }

  if (baseline.suppressedReviewVersionId === note.versionId) {
    return { kind: "editor" };
  }

  return { baseVersionId: note.pendingReviewBaseVersionId, kind: "review" };
};

export const shouldAdoptAgentWrite = (
  note: {
    contentHash: string;
    lastAuthor: "agent" | "user";
    pendingReviewBaseVersionId: string | null;
  },
  baseline: NoteEditorBaseline,
): boolean => {
  if (note.lastAuthor !== "agent" || note.pendingReviewBaseVersionId || baseline.dirty) {
    return false;
  }

  return baseline.contentHash !== note.contentHash;
};
