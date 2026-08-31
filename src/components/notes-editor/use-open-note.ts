import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";

type NoteSearch = {
  note?: {
    id: string;
    diff?: string;
    timeline?: boolean;
  };
  notes?: boolean;
  noteTabs?: string[];
};

export const setNoteSearchOpen =
  (noteId: string) =>
  <Search extends NoteSearch>(prev: Search): Search =>
    produce(prev, (draft: NoteSearch) => {
      draft.notes = true;
      draft.noteTabs = draft.noteTabs?.includes(noteId)
        ? draft.noteTabs
        : [...(draft.noteTabs ?? []), noteId];

      if (draft.note?.id === noteId) return;

      draft.note = { id: noteId, timeline: draft.note?.timeline };
    });

export const setNoteDiffOpen =
  (versionId: string) =>
  <Search extends NoteSearch>(prev: Search): Search =>
    produce(prev, (draft: NoteSearch) => {
      if (!draft.note) return;

      draft.note.diff = versionId;
    });

export const clearNoteDiff = <Search extends NoteSearch>(prev: Search): Search =>
  produce(prev, (draft: NoteSearch) => {
    if (!draft.note) return;

    draft.note.diff = undefined;
  });

export const closeNoteTimeline = <Search extends NoteSearch>(prev: Search): Search =>
  produce(prev, (draft: NoteSearch) => {
    if (!draft.note) return;

    draft.note.timeline = undefined;
  });

export const useOpenNote = () => {
  const navigate = useNavigate();

  return async (noteId: string) => navigate({ search: setNoteSearchOpen(noteId), to: "." });
};
