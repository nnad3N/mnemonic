import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMatch, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { PlateController, usePlateEditor } from "platejs/react";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
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
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteBaselineContext } from "./note-baseline-context";
import { NotePlate } from "./note-chrome";
import {
  NoteDiffStats,
  NoteFloatingBar,
  NoteHistoryEditor,
  NoteReviewEditor,
} from "./note-diff-editor";
import { NoteTimeline } from "./note-timeline";
import {
  createNoteBaselineStore,
  resolveNoteView,
  shouldAdoptRemoteWrite,
  useNoteBaselineStore,
} from "./notes-store";
import { NotesTabs } from "./notes-tabs";
import { notesEditorPlugins } from "./plugins";

const BODY_SAVE_DEBOUNCE_MS = 300;
const BODY_SAVE_MAX_WAIT_MS = 1000;

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
        <div className="flex h-full min-h-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <NotesTabs onClose={onClose} threadId={threadMatch?.params.threadId} />
            {activeNoteId && (
              <div className="flex min-h-0 flex-1 flex-col">
                <Suspense>
                  <NoteView key={activeNoteId} noteId={activeNoteId} />
                </Suspense>
              </div>
            )}
          </div>
          {timelineOpen && activeNoteId && (
            <Suspense>
              <NoteTimeline noteId={activeNoteId} />
            </Suspense>
          )}
        </div>
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

  // Render-time state adjustment: the fresh session remounts the editor, which reads the new
  // content at mount.
  if (shouldAdoptRemoteWrite(note, baseline)) {
    setSession(createNoteSession(note, session.seq + 1));

    return null;
  }

  const view = resolveNoteView(note, baseline, historyDiffId);

  return (
    <NoteBaselineContext value={session.store}>
      <NoteViewPane noteId={noteId} sessionSeq={session.seq} view={view} />
    </NoteBaselineContext>
  );
};

type NoteViewPaneProps = {
  noteId: string;
  sessionSeq: number;
  view: ReturnType<typeof resolveNoteView>;
};

const NoteViewPane = ({ noteId, sessionSeq, view }: NoteViewPaneProps) => {
  switch (view.kind) {
    case "history": {
      return (
        <NoteHistoryEditor
          baseVersionId={view.baseVersionId}
          key={view.baseVersionId}
          noteId={noteId}
        />
      );
    }
    case "review": {
      return <NoteReviewEditor baseVersionId={view.baseVersionId} noteId={noteId} />;
    }
    case "editor": {
      return <NoteEditor key={sessionSeq} noteId={noteId} />;
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
    <NotePlate
      editor={editor}
      noteId={noteId}
      onValueChange={() => {
        markEdited(note.pendingReviewBaseVersionId ? note.versionId : null);
        saveDebounced();
      }}
      title={note.title}
    >
      {note.pendingReviewBaseVersionId && (
        <NoteFloatingBar>
          <span className="px-1">
            <T>Assistant updated this note</T>
          </span>
          {remoteCounts && <NoteDiffStats counts={remoteCounts} noteId={noteId} />}
          <Button
            onClick={() => {
              allowReview();
              saveDebounced.flush();
            }}
            size="xs"
          >
            <T>Review</T>
          </Button>
        </NoteFloatingBar>
      )}
    </NotePlate>
  );
};
