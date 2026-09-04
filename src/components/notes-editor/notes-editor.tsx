import { useSuspenseQuery } from "@tanstack/react-query";
import { useMatch, useSearch } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";
import { PlateController, usePlateEditor } from "platejs/react";
import { Suspense, useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { WordDiffStats } from "@/components/word-diff";
import { markdownToText } from "@/lib/markdown";
import { markdownToPlate, plateToMarkdown } from "@/lib/plate";
import { diffWordCounts } from "@/lib/word-diff";
import { noteQueries } from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteBaselineContext } from "./note-baseline-context";
import { NotePlate } from "./note-chrome";
import { NoteFloatingBar, NoteHistoryEditor, NoteReviewEditor } from "./note-diff-editor";
import { NoteTimeline } from "./note-timeline";
import {
  createNoteBaselineStore,
  resolveNoteView,
  shouldAdoptRemoteWrite,
  useNoteBaselineStore,
} from "./notes-store";
import { NotesTabs } from "./notes-tabs";
import { notesEditorPlugins } from "./plugins";
import { useNoteBodySave } from "./use-note-body-save";

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
          <NoteTimeline noteId={activeNoteId} open={timelineOpen} />
        </div>
      </PlateController>
    </SidebarInset>
  );
};

type NoteViewProps = {
  noteId: string;
};

const createNoteSession = (
  note: { baseVersionId: string | null; contentHash: string },
  seq: number,
) => ({
  seq,
  store: createNoteBaselineStore({
    baseVersionId: note.baseVersionId,
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
  const { data: note } = useSuspenseQuery(noteQueries.byId(noteId));
  const allowReview = useStore(useNoteBaselineStore(), (state) => state.allowReview);
  const editor = usePlateEditor({
    plugins: notesEditorPlugins,
    value: (plate) => markdownToPlate(plate, note.content),
  });
  const { flushSave, scheduleSave } = useNoteBodySave({
    noteId,
    onStale: (fresh) => {
      editor.tf.setValue(markdownToPlate(editor, fresh.content));
    },
    serialize: () => plateToMarkdown(editor),
  });

  const remoteCounts = useMemo(() => {
    if (!note.pendingReviewBaseVersionId) {
      return null;
    }

    return diffWordCounts(markdownToText(plateToMarkdown(editor)), markdownToText(note.content));
  }, [editor, note.content, note.pendingReviewBaseVersionId]);

  return (
    <NotePlate editor={editor} noteId={noteId} onValueChange={scheduleSave} title={note.title}>
      {note.pendingReviewBaseVersionId && (
        <NoteFloatingBar>
          <span className="px-1">
            <T>Assistant updated this note</T>
          </span>
          {remoteCounts && <WordDiffStats className="px-2" counts={remoteCounts} />}
          <Button
            onClick={() => {
              allowReview();
              flushSave();
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
