import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { Plate, PlateContent, useEditorContainerRef } from "platejs/react";
import type { PlateEditor } from "platejs/react";
import type { PropsWithChildren, ReactNode } from "react";
import { useId } from "react";
import { useDebouncedCallback } from "use-debounce";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  noteQueries,
  saveNoteTitle,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteFontSizeButton } from "./font-size-button";
import {
  NoteHistoryButtons,
  NoteListsMenu,
  NoteMarkButtons,
  NoteMoreFormatMenu,
  NoteTableMenu,
  NoteToolbarSeparator,
  NoteTurnIntoButton,
} from "./toolbar-buttons";

const TITLE_SAVE_DEBOUNCE_MS = 250;

type NoteTitleInputProps = {
  noteId: string;
  title: string;
};

const NoteTitleInput = ({ noteId, title }: NoteTitleInputProps) => {
  const gt = useGT();
  const inputId = useId();
  const queryClient = useQueryClient();
  const saveTitle = useMutation({
    mutationFn: async (nextTitle: string) => saveNoteTitle({ data: { noteId, title: nextTitle } }),
  });
  const saveTitleDebounced = useDebouncedCallback(
    (nextTitle: string) => {
      saveTitle.mutate(nextTitle);
    },
    TITLE_SAVE_DEBOUNCE_MS,
    { flushOnExit: true },
  );

  const setTitle = (nextTitle: string) => {
    queryClient.setQueryData(noteQueries.byId(noteId).queryKey, (previous) =>
      produce(previous, (draft) => {
        if (!draft) return;

        draft.title = nextTitle;
      }),
    );
  };

  return (
    <div className="shrink-0 px-4 pt-4">
      <label className="sr-only" htmlFor={inputId}>
        <T>Note title</T>
      </label>
      <input
        className="w-full bg-transparent text-xl font-medium outline-none placeholder:text-muted-foreground"
        id={inputId}
        onBlur={() => {
          if (title.trim().length > 0) return;

          setTitle(gt("Untitled"));
          saveTitleDebounced(gt("Untitled"));
        }}
        onChange={(event) => {
          const nextTitle = event.target.value;

          setTitle(nextTitle);

          if (nextTitle.trim().length > 0) {
            saveTitleDebounced(nextTitle);
          }
        }}
        placeholder={gt("Untitled")}
        value={title}
      />
    </div>
  );
};

const NotesEditorToolbar = () => (
  <div className="flex shrink-0 items-center gap-0.5 border-b border-foreground/3 px-2 py-1 dark:border-white/5">
    <NoteHistoryButtons />
    <NoteToolbarSeparator />
    <NoteTurnIntoButton />
    <NoteToolbarSeparator />
    <NoteFontSizeButton />
    <NoteToolbarSeparator />
    <NoteMarkButtons />
    <NoteMoreFormatMenu />
    <NoteToolbarSeparator />
    <NoteListsMenu />
    <NoteToolbarSeparator />
    <NoteTableMenu />
  </div>
);

type NotePlateProps = {
  children?: ReactNode;
  editor: PlateEditor;
  noteId: string;
  onValueChange: () => void;
  title: string;
};

export const NotePlate = ({ children, editor, noteId, onValueChange, title }: NotePlateProps) => (
  <Plate editor={editor} onValueChange={onValueChange}>
    <NotesEditorToolbar />
    <NoteTitleInput noteId={noteId} title={title} />
    <NotePlateBody>{children}</NotePlateBody>
  </Plate>
);

const NotePlateBody = ({ children }: PropsWithChildren) => {
  const gt = useGT();
  const editorContainerRef = useEditorContainerRef();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1 cursor-text" viewportRef={editorContainerRef}>
        {/* Bottom padding is twice `NoteFloatingBar`'s height plus its offset, so text scrolls clear of it. */}
        <PlateContent
          className="typeset px-4 py-2 pb-26 text-sm outline-none **:data-slate-placeholder:text-muted-foreground"
          placeholder={gt("Write something…")}
        />
      </ScrollArea>
      {children}
    </div>
  );
};
