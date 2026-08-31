import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { ALargeSmallIcon, BoldIcon, IndentIcon, ListIcon } from "lucide-react";
import { Plate, PlateContent, useEditorContainerRef } from "platejs/react";
import type { PlateEditor } from "platejs/react";
import type { PropsWithChildren, ReactNode, Ref } from "react";
import { useId } from "react";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  noteQueries,
  saveNoteTitle,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteFontSizeButton } from "./font-size-button";
import {
  NoteClearFormattingButton,
  NoteHistoryButtons,
  NoteIndentButtons,
  NoteLinkButton,
  NoteListButtons,
  NoteMarkButtons,
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
  <div className="@container/toolbar shrink-0 border-b border-foreground/3 dark:border-white/5">
    <ScrollArea>
      <div className="flex min-w-max items-center gap-0.5 px-2 py-1">
        <NoteHistoryButtons />
        <NoteToolbarSeparator />
        <NoteTurnIntoButton />
        <NoteToolbarSeparator />
        <NoteFontSizeGroup />
        <NoteToolbarSeparator />
        <NoteMarkGroup />
        <NoteToolbarSeparator />
        <NoteListGroup />
        <NoteToolbarSeparator />
        <NoteIndentGroup />
      </div>
    </ScrollArea>
  </div>
);

const NoteMarkGroupButtons = () => (
  <>
    <NoteMarkButtons />
    <NoteLinkButton />
  </>
);

const NoteIndentGroupButtons = () => (
  <>
    <NoteIndentButtons />
    <NoteClearFormattingButton />
  </>
);

const NoteFontSizeGroup = () => {
  const gt = useGT();

  return (
    <>
      <div className="hidden @xl/toolbar:flex">
        <NoteFontSizeButton />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="@xl/toolbar:hidden"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <ALargeSmallIcon />
          <span className="sr-only">{gt("Font size")}</span>
        </DropdownMenuTrigger>
        <NoteGroupMenuContent>
          <NoteFontSizeButton />
        </NoteGroupMenuContent>
      </DropdownMenu>
    </>
  );
};

const NoteMarkGroup = () => {
  const gt = useGT();

  return (
    <>
      <div className="hidden items-center gap-0.5 @2xl/toolbar:flex">
        <NoteMarkGroupButtons />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="@2xl/toolbar:hidden"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <BoldIcon />
          <span className="sr-only">{gt("Text formatting")}</span>
        </DropdownMenuTrigger>
        <NoteGroupMenuContent>
          <NoteMarkGroupButtons />
        </NoteGroupMenuContent>
      </DropdownMenu>
    </>
  );
};

const NoteListGroup = () => {
  const gt = useGT();

  return (
    <>
      <div className="hidden items-center gap-0.5 @3xl/toolbar:flex">
        <NoteListButtons />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="@3xl/toolbar:hidden"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <ListIcon />
          <span className="sr-only">{gt("Lists")}</span>
        </DropdownMenuTrigger>
        <NoteGroupMenuContent>
          <NoteListButtons />
        </NoteGroupMenuContent>
      </DropdownMenu>
    </>
  );
};

const NoteIndentGroup = () => {
  const gt = useGT();

  return (
    <>
      <div className="hidden items-center gap-0.5 @min-[50rem]/toolbar:flex">
        <NoteIndentGroupButtons />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="@min-[50rem]/toolbar:hidden"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <IndentIcon />
          <span className="sr-only">{gt("Indentation")}</span>
        </DropdownMenuTrigger>
        <NoteGroupMenuContent>
          <NoteIndentGroupButtons />
        </NoteGroupMenuContent>
      </DropdownMenu>
    </>
  );
};

const NoteGroupMenuContent = ({ children }: PropsWithChildren) => (
  <DropdownMenuContent className="w-auto min-w-0" finalFocus={false}>
    {children}
  </DropdownMenuContent>
);

type NotePlateProps = {
  children?: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  editor: PlateEditor;
  noteId: string;
  onValueChange: () => void;
  title: string;
};

export const NotePlate = ({
  children,
  containerRef,
  editor,
  noteId,
  onValueChange,
  title,
}: NotePlateProps) => (
  <Plate editor={editor} onValueChange={onValueChange}>
    <NotesEditorToolbar />
    <NoteTitleInput noteId={noteId} title={title} />
    <NotePlateBody containerRef={containerRef}>{children}</NotePlateBody>
  </Plate>
);

type NotePlateBodyProps = {
  children?: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
};

const NotePlateBody = ({ children, containerRef }: NotePlateBodyProps) => {
  const gt = useGT();
  const editorContainerRef = useEditorContainerRef();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" ref={containerRef}>
      <ScrollArea className="min-h-0 flex-1 cursor-text" viewportRef={editorContainerRef}>
        <PlateContent
          className="typeset px-4 py-2 pb-16 text-sm outline-none **:data-slate-placeholder:text-muted-foreground"
          placeholder={gt("Write something…")}
        />
      </ScrollArea>
      {children}
    </div>
  );
};
