import { T, useGT } from "gt-tanstack-start";
import { XIcon } from "lucide-react";
import { Plate, PlateContent, useEditorContainerRef, usePlateEditor } from "platejs/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset } from "@/components/ui/sidebar";

import { NoteFontSizeButton } from "./font-size-button";
import { notesEditorPlugins } from "./plugins";
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

type NotesEditorProps = {
  onClose: () => void;
};

export const NotesEditor = ({ onClose }: NotesEditorProps) => {
  const editor = usePlateEditor({ plugins: notesEditorPlugins });

  return (
    <SidebarInset className="h-full min-h-0 overflow-hidden">
      <NotesEditorHeader onClose={onClose} />
      <Plate editor={editor}>
        <NotesEditorToolbar />
        <NotesEditorBody />
      </Plate>
    </SidebarInset>
  );
};

type NotesEditorHeaderProps = {
  onClose: () => void;
};

const NotesEditorHeader = ({ onClose }: NotesEditorHeaderProps) => {
  const gt = useGT();
  const [title, setTitle] = useState("");

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-foreground/3 px-2 md:h-10 dark:border-white/5">
      <label className="sr-only" htmlFor="note-title">
        <T>Note title</T>
      </label>
      <input
        className="min-w-0 flex-1 bg-transparent px-1.5 text-sm font-medium outline-none placeholder:text-muted-foreground"
        id="note-title"
        onChange={(event) => {
          setTitle(event.target.value);
        }}
        placeholder={gt("Untitled")}
        value={title}
      />
      <Button onClick={onClose} size="icon-sm" variant="ghost">
        <XIcon />
        <span className="sr-only">
          <T>Close notes</T>
        </span>
      </Button>
    </div>
  );
};

const NotesEditorToolbar = () => (
  <ScrollArea className="shrink-0 border-b border-foreground/3 dark:border-white/5">
    <div className="flex w-max items-center gap-0.5 px-2 py-1">
      <NoteHistoryButtons />
      <NoteToolbarSeparator />
      <NoteTurnIntoButton />
      <NoteToolbarSeparator />
      <NoteFontSizeButton />
      <NoteToolbarSeparator />
      <NoteMarkButtons />
      <NoteLinkButton />
      <NoteToolbarSeparator />
      <NoteListButtons />
      <NoteIndentButtons />
      <NoteClearFormattingButton />
    </div>
  </ScrollArea>
);

/** The scrolling viewport is the editor container, so Plate positions against what the reader sees. */
const NotesEditorBody = () => {
  const gt = useGT();
  const containerRef = useEditorContainerRef();

  return (
    <ScrollArea className="min-h-0 flex-1 cursor-text" viewportRef={containerRef}>
      <PlateContent
        className="typeset px-6 py-4 text-sm outline-none **:data-slate-placeholder:text-muted-foreground"
        placeholder={gt("Write something…")}
      />
    </ScrollArea>
  );
};
