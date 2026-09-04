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
  (noteId: string, diff?: string) =>
  <Search extends NoteSearch>(prev: Search): Search =>
    produce(prev, (draft: NoteSearch) => {
      const openDiff = diff ?? (draft.note?.id === noteId ? draft.note.diff : undefined);

      draft.notes = true;
      draft.noteTabs ??= [];
      draft.note = { id: noteId, diff: openDiff, timeline: draft.note?.timeline };

      if (!draft.noteTabs.includes(noteId)) {
        draft.noteTabs.push(noteId);
      }
    });

export const setNotesSearchOpen =
  (noteIds: string[]) =>
  <Search extends NoteSearch>(prev: Search): Search =>
    produce(prev, (draft: NoteSearch) => {
      const [firstId] = noteIds;

      if (!firstId) return;

      draft.notes = true;
      draft.noteTabs ??= [];
      draft.note = { id: firstId, timeline: draft.note?.timeline };

      for (const noteId of noteIds) {
        if (!draft.noteTabs.includes(noteId)) {
          draft.noteTabs.push(noteId);
        }
      }
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
