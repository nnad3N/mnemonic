import {
  BasicMarksPlugin,
  BlockquotePlugin,
  HeadingPlugin,
  HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";
import { FontSizePlugin } from "@platejs/basic-styles/react";
import { CodeBlockPlugin, CodeLinePlugin } from "@platejs/code-block/react";
import { IndentPlugin } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { BulletedListRules, OrderedListRules, TaskListRules } from "@platejs/list";
import { ListPlugin } from "@platejs/list/react";
import { MarkdownPlugin } from "@platejs/markdown";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMatch, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { KEYS, TrailingBlockPlugin } from "platejs";
import { Plate, PlateContent, useEditorContainerRef, usePlateEditor } from "platejs/react";
import { Suspense, useEffect } from "react";
import remarkGfm from "remark-gfm";
import { useDebouncedCallback } from "use-debounce";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset } from "@/components/ui/sidebar";
import { hashText } from "@/lib/hash";
import { markdownToPlate, plateToMarkdown } from "@/lib/plate";
import {
  noteQueries,
  saveNoteBody,
  saveNoteTitle,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteFontSizeButton } from "./font-size-button";
import { NoteLinkToolbar } from "./link-toolbar";
import {
  NoteBlockList,
  NoteBlockquoteElement,
  NoteCodeBlockElement,
  NoteHorizontalRuleElement,
  NoteLinkElement,
} from "./nodes";
import { NotesTabs } from "./notes-tabs";
import { NoteSlashInputElement } from "./slash-input";
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

/** Blocks a list item can be turned into, and blocks indentation applies to. */
const indentTargets = [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock];

const notesEditorPlugins = [
  HeadingPlugin,
  BlockquotePlugin.withComponent(NoteBlockquoteElement),
  HorizontalRulePlugin.withComponent(NoteHorizontalRuleElement),
  BasicMarksPlugin,
  FontSizePlugin,
  CodeBlockPlugin.withComponent(NoteCodeBlockElement),
  CodeLinePlugin,
  IndentPlugin.configure({ inject: { targetPlugins: indentTargets } }),
  ListPlugin.configure({
    inject: { targetPlugins: indentTargets },
    inputRules: [
      BulletedListRules.markdown({ variant: "-" }),
      OrderedListRules.markdown({ variant: "." }),
      TaskListRules.markdown({ checked: false }),
    ],
    render: { belowNodes: NoteBlockList },
  }),
  LinkPlugin.configure({
    render: { afterEditable: NoteLinkToolbar },
  }).withComponent(NoteLinkElement),
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor) =>
        !editor.api.some({ match: { type: editor.getType(KEYS.codeBlock) } }),
    },
  }),
  SlashInputPlugin.withComponent(NoteSlashInputElement),
  MarkdownPlugin.configure({ options: { remarkPlugins: [remarkGfm] } }),
  TrailingBlockPlugin,
];

const BODY_SAVE_INTERVAL_MS = 3000;
const TITLE_SAVE_DEBOUNCE_MS = 500;

type NotesEditorProps = {
  onClose: () => void;
};

export const NotesEditor = ({ onClose }: NotesEditorProps) => {
  const threadMatch = useMatch({ from: "/_protected/chat/$threadId", shouldThrow: false });
  const activeNoteId = useSearch({ from: "/_protected", select: (search) => search.note });

  return (
    <SidebarInset className="h-full min-h-0 overflow-hidden">
      <NotesTabs onClose={onClose} threadId={threadMatch?.params.threadId} />
      {activeNoteId && (
        <Suspense>
          <NoteEditor key={activeNoteId} noteId={activeNoteId} />
        </Suspense>
      )}
    </SidebarInset>
  );
};

type NoteEditorProps = {
  noteId: string;
};

const NoteEditor = ({ noteId }: NoteEditorProps) => {
  const queryClient = useQueryClient();
  const noteQuery = noteQueries.byId(noteId);
  const { data: note } = useSuspenseQuery(noteQuery);
  const editor = usePlateEditor({
    plugins: notesEditorPlugins,
    value: (plate) => markdownToPlate(plate, note.content),
  });
  const saveMutationKey = [...noteQuery.queryKey, "body"] as const;
  const save = useMutation({
    mutationKey: saveMutationKey,
    mutationFn: async () => {
      // The count includes this call, so above one means an earlier save is still in flight.
      if (queryClient.isMutating({ mutationKey: saveMutationKey }) > 1) return;

      const content = plateToMarkdown(editor);
      const contentHash = await hashText(content);

      if (contentHash === queryClient.getQueryData(noteQuery.queryKey)?.contentHash) return;

      const saved = await saveNoteBody({ data: { content, noteId } });

      queryClient.setQueryData(noteQuery.queryKey, (previous) =>
        produce(previous, (draft) => {
          if (!draft) return;

          draft.content = content;
          draft.contentHash = saved.contentHash;
        }),
      );

      return { content, contentHash: saved.contentHash };
    },
  });
  const runSave = save.mutate;

  useEffect(() => {
    const interval = setInterval(() => {
      runSave();
    }, BODY_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [runSave]);

  return (
    <Plate editor={editor}>
      <NotesEditorToolbar />
      <NoteTitleInput noteId={noteId} title={note.title} />
      <NotesEditorBody />
    </Plate>
  );
};

type NoteTitleInputProps = {
  noteId: string;
  title: string;
};

const NoteTitleInput = ({ noteId, title }: NoteTitleInputProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const saveTitle = useMutation({
    mutationFn: async (nextTitle: string) => saveNoteTitle({ data: { noteId, title: nextTitle } }),
  });
  const saveTitleDebounced = useDebouncedCallback((nextTitle: string) => {
    saveTitle.mutate(nextTitle);
  }, TITLE_SAVE_DEBOUNCE_MS);

  return (
    <div className="shrink-0 px-6 pt-4">
      <label className="sr-only" htmlFor="note-title">
        <T>Note title</T>
      </label>
      <input
        className="w-full bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
        id="note-title"
        onChange={(event) => {
          const nextTitle = event.target.value;

          queryClient.setQueryData(noteQueries.byId(noteId).queryKey, (previous) =>
            produce(previous, (draft) => {
              if (!draft) return;

              draft.title = nextTitle;
            }),
          );
          saveTitleDebounced(nextTitle);
        }}
        placeholder={gt("Untitled")}
        value={title}
      />
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
