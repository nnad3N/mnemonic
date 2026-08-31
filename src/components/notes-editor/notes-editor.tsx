import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMatch, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { ALargeSmallIcon, BoldIcon, IndentIcon, ListIcon } from "lucide-react";
import {
  Plate,
  PlateContent,
  PlateController,
  useEditorContainerRef,
  usePlateEditor,
} from "platejs/react";
import type { PropsWithChildren } from "react";
import { Suspense, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset } from "@/components/ui/sidebar";
import { ServerFnError } from "@/lib/errors/server-fn-error";
import { hashText } from "@/lib/hash";
import { markdownToText } from "@/lib/markdown";
import { markdownToPlate, plateToMarkdown } from "@/lib/plate";
import { diffWordCounts } from "@/lib/word-diff";
import {
  STALE_NOTE_VERSION_STATUS,
  noteQueries,
  saveNoteBody,
  saveNoteTitle,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteFontSizeButton } from "./font-size-button";
import { NoteBaselineContext } from "./note-baseline-context";
import { NoteDiffStats, NoteFloatingBar, NoteHistoryDiff, NoteReviewDiff } from "./note-diff-view";
import { NoteTimeline } from "./note-timeline";
import {
  createNoteBaselineStore,
  resolveNoteView,
  shouldAdoptAgentWrite,
  useNoteBaselineStore,
} from "./notes-store";
import { NotesTabs } from "./notes-tabs";
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

const BODY_SAVE_DEBOUNCE_MS = 300;
const BODY_SAVE_MAX_WAIT_MS = 1000;
const TITLE_SAVE_DEBOUNCE_MS = 250;

type NotesEditorProps = {
  onClose: () => void;
};

export const NotesEditor = ({ onClose }: NotesEditorProps) => {
  const threadMatch = useMatch({ from: "/_protected/chat/$threadId", shouldThrow: false });
  const { activeNoteId, timelineOpen } = useSearch({
    from: "/_protected",
    select: (search) => ({
      activeNoteId: search.note?.id,
      timelineOpen: Boolean(search.note?.timeline),
    }),
  });

  return (
    <SidebarInset className="h-full min-h-0 overflow-hidden">
      {/* Export lives in the tab bar, outside the note's own `Plate`, and reaches it from here. */}
      <PlateController>
        <NotesTabs onClose={onClose} threadId={threadMatch?.params.threadId} />
        {activeNoteId && (
          <div className="flex min-h-0 flex-1">
            <div className="flex h-full min-w-0 flex-1 flex-col">
              <Suspense>
                <NoteView key={activeNoteId} noteId={activeNoteId} />
              </Suspense>
            </div>
            {timelineOpen && (
              <Suspense>
                <NoteTimeline noteId={activeNoteId} />
              </Suspense>
            )}
          </div>
        )}
      </PlateController>
    </SidebarInset>
  );
};

type NoteViewProps = {
  noteId: string;
};

const createNoteSession = (
  note: { contentHash: string; lastAuthor: "agent" | "user"; versionId: string },
  seq: number,
) => ({
  seq,
  store: createNoteBaselineStore({
    baseVersionId: note.lastAuthor === "user" ? note.versionId : null,
    contentHash: note.contentHash,
  }),
});

const NoteView = ({ noteId }: NoteViewProps) => {
  const historyDiffId = useSearch({ from: "/_protected", select: (search) => search.note?.diff });
  const { data: note } = useSuspenseQuery(noteQueries.byId(noteId));
  const [session, setSession] = useState(() => createNoteSession(note, 0));
  const baseline = useStore(session.store);

  // Render-time state adjustment: the fresh session remounts the editor, which reads the
  // agent's content at mount.
  if (shouldAdoptAgentWrite(note, baseline)) {
    setSession(createNoteSession(note, session.seq + 1));

    return null;
  }

  const view = resolveNoteView(note, baseline, historyDiffId);

  switch (view.kind) {
    case "history": {
      return <NoteHistoryDiff baseVersionId={view.baseVersionId} noteId={noteId} />;
    }
    case "review": {
      return <NoteReviewDiff baseVersionId={view.baseVersionId} noteId={noteId} />;
    }
    case "editor": {
      return (
        <NoteBaselineContext value={session.store}>
          <NoteEditor key={session.seq} noteId={noteId} />
        </NoteBaselineContext>
      );
    }
  }
};

type NoteEditorProps = {
  noteId: string;
};

const NoteEditor = ({ noteId }: NoteEditorProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const noteQuery = noteQueries.byId(noteId);
  const { data: note } = useSuspenseQuery(noteQuery);
  const store = useNoteBaselineStore();
  const { allowReview, confirmSaved, markEdited, seedBaseline } = store.getState();
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

      const baseline = store.getState();
      const editSeq = baseline.editSeq;
      const content = plateToMarkdown(editor);
      const contentHash = await hashText(content);

      if (contentHash === baseline.contentHash) {
        confirmSaved(editSeq, { baseVersionId: baseline.baseVersionId, contentHash });

        return;
      }

      const saved = await saveNoteBody({
        data: baseline.baseVersionId
          ? { baseVersionId: baseline.baseVersionId, content, intent: "overwrite", noteId }
          : { content, intent: "append", noteId },
      });

      confirmSaved(editSeq, { baseVersionId: saved.versionId, contentHash: saved.contentHash });

      if (saved.isLatest) {
        queryClient.setQueryData(noteQuery.queryKey, (previous) =>
          produce(previous, (draft) => {
            if (!draft) return;

            draft.content = content;
            draft.contentHash = saved.contentHash;
            draft.lastAuthor = "user";
            draft.pendingReviewBaseVersionId = null;
            draft.versionId = saved.versionId;
          }),
        );
      }

      void queryClient.invalidateQueries({ queryKey: noteQueries.versionLists(noteId) });

      return saved;
    },
    onError: async (error) => {
      if (ServerFnError.is(error) && error.status === STALE_NOTE_VERSION_STATUS) {
        // Another tab moved the chain; that tab's state wins and this editor reseeds onto it.
        await queryClient.invalidateQueries({ queryKey: noteQuery.queryKey });

        const fresh = queryClient.getQueryData(noteQuery.queryKey);

        if (!fresh) return;

        editor.tf.setValue(markdownToPlate(editor, fresh.content));
        seedBaseline({
          baseVersionId: fresh.lastAuthor === "user" ? fresh.versionId : null,
          contentHash: fresh.contentHash,
        });

        return;
      }

      toast.error(gt("Failed to save the note"));
    },
  });
  const runSave = save.mutate;
  const saveDebounced = useDebouncedCallback(runSave, BODY_SAVE_DEBOUNCE_MS, {
    flushOnExit: true,
    maxWait: BODY_SAVE_MAX_WAIT_MS,
  });

  const remoteCounts = useMemo(() => {
    if (!note.pendingReviewBaseVersionId) return null;

    return diffWordCounts(markdownToText(plateToMarkdown(editor)), markdownToText(note.content));
  }, [editor, note.content, note.pendingReviewBaseVersionId]);

  return (
    <Plate
      editor={editor}
      onValueChange={() => {
        markEdited(note.pendingReviewBaseVersionId ? note.versionId : null);
        saveDebounced();
      }}
    >
      <NotesEditorToolbar />
      <NoteTitleInput noteId={noteId} title={note.title} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <NotesEditorBody />
        {note.pendingReviewBaseVersionId && (
          <NoteFloatingBar>
            <span className="px-1">
              <T>Assistant updated this note</T>
            </span>
            {remoteCounts && <NoteDiffStats counts={remoteCounts} />}
            <Button
              onClick={() => {
                allowReview();
                saveDebounced.flush();
              }}
              size="sm"
            >
              <T>Review</T>
            </Button>
          </NoteFloatingBar>
        )}
      </div>
    </Plate>
  );
};

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

const NotesEditorBody = () => {
  const gt = useGT();
  const containerRef = useEditorContainerRef();

  return (
    <ScrollArea className="min-h-0 flex-1 cursor-text" viewportRef={containerRef}>
      <PlateContent
        className="typeset px-4 py-2 text-sm outline-none **:data-slate-placeholder:text-muted-foreground"
        placeholder={gt("Write something…")}
      />
    </ScrollArea>
  );
};
