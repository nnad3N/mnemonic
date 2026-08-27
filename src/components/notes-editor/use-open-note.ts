import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";

type NoteSearch = {
  note?: string;
  notes?: boolean;
  noteTabs?: string[];
};

export const setNoteSearchOpen =
  (noteId: string) =>
  <Search extends NoteSearch>(prev: Search): Search =>
    produce(prev, (draft: NoteSearch) => {
      draft.note = noteId;
      draft.notes = true;
      draft.noteTabs = draft.noteTabs?.includes(noteId)
        ? draft.noteTabs
        : [...(draft.noteTabs ?? []), noteId];
    });

export const useOpenNote = () => {
  const navigate = useNavigate();

  return async (noteId: string) => navigate({ search: setNoteSearchOpen(noteId), to: "." });
};
