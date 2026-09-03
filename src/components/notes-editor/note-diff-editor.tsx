import { computeDiff, withGetFragmentExcludeDiff } from "@platejs/diff";
import type { DiffOperation } from "@platejs/diff";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Result } from "better-result";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { ElementApi, createSlatePlugin } from "platejs";
import type { Descendant, Value } from "platejs";
import { PlateLeaf, createPlateEditor, toPlatePlugin, usePlateEditor } from "platejs/react";
import type { PlateLeafProps } from "platejs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import { WordDiffStats } from "@/components/word-diff";
import { ServerFnError } from "@/lib/errors/server-fn-error";
import { hashText } from "@/lib/hash";
import { markdownToText } from "@/lib/markdown";
import { markdownToPlate, plateToMarkdown } from "@/lib/plate";
import { rebaseText } from "@/lib/text-rebase";
import { cn } from "@/lib/utils";
import { diffWordCounts } from "@/lib/word-diff";
import type { WordDiffCounts } from "@/lib/word-diff";
import {
  STALE_NOTE_VERSION_STATUS,
  declineAgentVersions,
  noteQueries,
  saveAgentVersion,
  saveNoteBody,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NotePlate } from "./note-chrome";
import { useNoteBaselineStore } from "./notes-store";
import { notesEditorPlugins } from "./plugins";
import { clearNoteDiff, setNoteDiffOpen } from "./use-open-note";

const diffOperationClasses = {
  delete: cn(
    "bg-f-red-600/15 line-through decoration-f-red-600/70",
    "dark:bg-f-red-400/20 dark:decoration-f-red-400/70",
  ),
  insert: cn("bg-f-green-600/15 dark:bg-f-green-400/20"),
  update: cn("bg-f-blue-600/15 dark:bg-f-blue-400/20"),
} satisfies Record<DiffOperation["type"], string>;

const NoteDiffLeaf = ({ children, ...props }: PlateLeafProps) => {
  // SAFETY: computeDiff put DiffProps on every node it marked, and this leaf renders only there.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const diffOperation = props.leaf.diffOperation as DiffOperation;

  return (
    <PlateLeaf
      {...props}
      attributes={{ ...props.attributes, "data-diff": diffOperation.type }}
      className={diffOperationClasses[diffOperation.type]}
    >
      {children}
    </PlateLeaf>
  );
};

const DiffPlugin = toPlatePlugin(
  createSlatePlugin({
    key: "diff",
    node: { isLeaf: true },
  }).overrideEditor(withGetFragmentExcludeDiff),
  {
    render: {
      node: NoteDiffLeaf,
      aboveNodes:
        () =>
        ({ children, editor, element }) => {
          if (element.diff !== true) {
            return children;
          }

          // SAFETY: computeDiff put DiffProps on every node it marked.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const diffOperation = element.diffOperation as DiffOperation;
          const Component = editor.api.isInline(element) ? "span" : "div";

          return (
            <Component
              className={diffOperationClasses[diffOperation.type]}
              data-diff={diffOperation.type}
            >
              {children}
            </Component>
          );
        },
    },
  },
);

const diffPlugins = [...notesEditorPlugins, DiffPlugin];

const DIFF_SAVE_DEBOUNCE_MS = 300;
const DIFF_SAVE_MAX_WAIT_MS = 1000;

const computeNoteDiffValue = (baseContent: string, targetContent: string): Value => {
  const scratch = createPlateEditor({ plugins: diffPlugins });

  // SAFETY: computeDiff merges two deserialized documents, so the roots stay block elements.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return computeDiff(
    markdownToPlate(scratch, baseContent),
    markdownToPlate(scratch, targetContent),
    { isInline: scratch.api.isInline, lineBreakChar: "¶" },
  ) as Value;
};

const isDiffDelete = (node: Descendant) => {
  if (node.diff !== true) {
    return false;
  }

  // SAFETY: computeDiff put DiffProps on every node it marked.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (node.diffOperation as DiffOperation).type === "delete";
};

/** The edited diff still holds the base version's deleted text; the target text is what remains. */
const stripDiffMarks = (nodes: Descendant[]): Descendant[] =>
  nodes.flatMap((node): Descendant[] => {
    if (isDiffDelete(node)) {
      return [];
    }

    if (!ElementApi.isElement(node)) {
      const { diff: _diff, diffOperation: _diffOperation, ...clean } = node;

      return [clean];
    }

    const { diff: _diff, diffOperation: _diffOperation, ...clean } = node;
    const children = stripDiffMarks(node.children);

    return children.length > 0 ? [{ ...clean, children }] : [];
  });

const stripDiffValue = (value: Value): Value =>
  value.flatMap((element): Value => {
    if (isDiffDelete(element)) {
      return [];
    }

    const { diff: _diff, diffOperation: _diffOperation, ...clean } = element;
    const children = stripDiffMarks(element.children);

    return children.length > 0 ? [{ ...clean, children }] : [];
  });

export const NoteFloatingBar = ({ children }: PropsWithChildren) => (
  <div className="absolute bottom-3 left-3 z-10 flex h-10 max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full border border-foreground/3 bg-background/50 px-2 text-sm backdrop-blur dark:border-white/5">
    {children}
  </div>
);

type NoteDiffBarProps = PropsWithChildren<{
  counts: WordDiffCounts;
  noteId: string;
  selectedVersionId: string;
}>;

type NoteVersionNavButtonProps = PropsWithChildren<{
  opensLatest?: boolean;
  versionId: string | undefined;
}>;

const NoteVersionNavButton = ({ children, opensLatest, versionId }: NoteVersionNavButtonProps) => {
  if (!versionId) {
    return (
      <Button disabled size="icon-sm" variant="ghost">
        {children}
      </Button>
    );
  }

  return (
    <Button
      nativeButton={false}
      render={<Link search={opensLatest ? clearNoteDiff : setNoteDiffOpen(versionId)} to="." />}
      size="icon-sm"
      variant="ghost"
    >
      {children}
    </Button>
  );
};

const NoteDiffBar = ({ children, counts, noteId, selectedVersionId }: NoteDiffBarProps) => {
  const { data: reviewPending } = useSuspenseQuery({
    ...noteQueries.byId(noteId),
    select: (note) => Boolean(note.pendingReviewBaseVersionId),
  });
  const {
    data: { newerVersionId, newestVersionId, olderVersionId },
  } = useSuspenseQuery({
    ...noteQueries.versions(noteId),
    select: (data) => {
      const index = data.entries.findIndex((entry) => entry.id === selectedVersionId);

      return {
        newerVersionId: index > 0 ? data.entries.at(index - 1)?.id : undefined,
        newestVersionId: data.entries.at(0)?.id,
        olderVersionId: index >= 0 ? data.entries.at(index + 1)?.id : undefined,
      };
    },
  });

  // Stepping onto the latest version leaves the diff, and only a pending review puts a bar of
  // its own in this one's place.
  const opensLatest = newerVersionId === newestVersionId;
  const newerTargetId = opensLatest && !reviewPending ? undefined : newerVersionId;

  return (
    <NoteFloatingBar>
      <NoteVersionNavButton versionId={olderVersionId}>
        <ChevronLeftIcon />
        <span className="sr-only">
          <T>Older version</T>
        </span>
      </NoteVersionNavButton>
      <NoteVersionNavButton opensLatest={opensLatest} versionId={newerTargetId}>
        <ChevronRightIcon />
        <span className="sr-only">
          <T>Newer version</T>
        </span>
      </NoteVersionNavButton>
      <div className="pr-2.5 pl-1">
        <WordDiffStats counts={counts} />
      </div>
      {children}
    </NoteFloatingBar>
  );
};

type NoteReviewEditorProps = {
  baseVersionId: string;
  noteId: string;
};

export const NoteReviewEditor = ({ baseVersionId, noteId }: NoteReviewEditorProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const noteQuery = noteQueries.byId(noteId);
  const { data: note } = useSuspenseQuery(noteQuery);
  const { data: base } = useSuspenseQuery(noteQueries.version(noteId, baseVersionId));
  const store = useNoteBaselineStore();
  const { seedBaseline } = store.getState();
  // Seeded once: after that the edits live in this editor, and saves flow back into the
  // agent's version rather than the editor reseeding from the cache.
  const [diffValue] = useState(() => computeNoteDiffValue(base.content, note.content));
  const editor = usePlateEditor({ plugins: diffPlugins, value: diffValue });
  // The agent text the review is based on, and its `updatedAt` stamp — every save sends the
  // stamp as its concurrency token, and a moved stamp routes through the merge effect below.
  const snapshot = useRef({
    targetContent: note.content,
    updatedAt: note.versionUpdatedAt.getTime(),
  });

  const save = useMutation({
    mutationFn: async (variables: { commit: boolean }) => {
      const content = plateToMarkdown(editor, stripDiffValue(editor.children));
      const saved = await saveAgentVersion({
        data: {
          commit: variables.commit,
          content,
          noteId,
          versionId: note.versionId,
          versionUpdatedAt: snapshot.current.updatedAt,
        },
      });

      snapshot.current = {
        targetContent: content,
        updatedAt: saved.updatedAt.getTime(),
      };

      return { content, saved };
    },
    onError: (error) => {
      if (ServerFnError.is(error) && error.status === STALE_NOTE_VERSION_STATUS) {
        // The agent wrote past the snapshot; the refetch feeds the merge effect below.
        void queryClient.invalidateQueries({ queryKey: noteQuery.queryKey });

        return;
      }

      toast.error(gt("Failed to save the note"));
    },
  });

  const saveDebounced = useDebouncedCallback(
    () => {
      save.mutate({ commit: false });
    },
    DIFF_SAVE_DEBOUNCE_MS,
    { flushOnExit: true, maxWait: DIFF_SAVE_MAX_WAIT_MS },
  );

  // The agent wrote while the review was open: rebase the reviewed text onto the agent's new
  // version, overlapping edits resolving to the agent's side.
  useEffect(() => {
    const remoteStamp = note.versionUpdatedAt.getTime();

    if (remoteStamp <= snapshot.current.updatedAt) return;

    const mine = plateToMarkdown(editor, stripDiffValue(editor.children));
    const merged = rebaseText(snapshot.current.targetContent, mine, note.content);

    snapshot.current = { targetContent: note.content, updatedAt: remoteStamp };

    if (merged !== mine) {
      editor.tf.setValue(computeNoteDiffValue(base.content, merged));
    }

    toast.info(gt("Merged the assistant's newer update"));
    saveDebounced();
  }, [base.content, editor, gt, note.content, note.versionUpdatedAt, saveDebounced]);

  const commit = async () => {
    saveDebounced.cancel();

    const result = await Result.tryPromise(async () => save.mutateAsync({ commit: true }));

    // A stale commit already scheduled the merge; the reviewer gets one more look.
    if (Result.isError(result)) return;

    const { content, saved } = result.value;

    queryClient.setQueryData(noteQuery.queryKey, (previous) =>
      produce(previous, (draft) => {
        if (!draft) return;

        draft.content = content;
        draft.contentHash = saved.contentHash;
        draft.pendingReviewBaseVersionId = null;
        draft.versionUpdatedAt = saved.updatedAt;
      }),
    );
    seedBaseline({ baseVersionId: null, contentHash: saved.contentHash });
    void queryClient.invalidateQueries({ queryKey: noteQueries.versionLists(noteId) });
  };

  const reject = useMutation({
    mutationFn: async () => {
      const restored = await declineAgentVersions({ data: { noteId } });

      queryClient.setQueryData(noteQuery.queryKey, (previous) =>
        produce(previous, (draft) => {
          if (!draft) return;

          draft.content = restored.content;
          draft.contentHash = restored.contentHash;
          draft.lastAuthor = restored.author;
          draft.pendingReviewBaseVersionId = null;
          draft.versionId = restored.versionId;
          draft.versionUpdatedAt = restored.updatedAt;
        }),
      );
      seedBaseline({
        baseVersionId: restored.author === "user" ? restored.versionId : null,
        contentHash: restored.contentHash,
      });
      void queryClient.invalidateQueries({ queryKey: noteQueries.versionLists(noteId) });
    },
    onError: () => {
      toast.error(gt("Failed to save the note"));
    },
  });

  const counts = useMemo(
    () => diffWordCounts(markdownToText(base.content), markdownToText(note.content)),
    [base.content, note.content],
  );

  return (
    <NotePlate
      editor={editor}
      noteId={noteId}
      onValueChange={() => {
        saveDebounced();
      }}
      title={note.title}
    >
      <NoteDiffBar counts={counts} noteId={noteId} selectedVersionId={note.versionId}>
        <Button
          disabled={reject.isPending}
          onClick={() => {
            saveDebounced.cancel();
            reject.mutate();
          }}
          size="xs"
          variant="ghost"
        >
          <T>Decline</T>
        </Button>
        <Button disabled={reject.isPending || save.isPending} onClick={commit} size="xs">
          <T>Accept</T>
        </Button>
      </NoteDiffBar>
    </NotePlate>
  );
};

type NoteHistoryEditorProps = {
  baseVersionId: string;
  noteId: string;
};

export const NoteHistoryEditor = ({ baseVersionId, noteId }: NoteHistoryEditorProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const noteQuery = noteQueries.byId(noteId);
  const { data: note } = useSuspenseQuery(noteQuery);
  const { data: base } = useSuspenseQuery(noteQueries.version(noteId, baseVersionId));
  const [diffValue] = useState(() => computeNoteDiffValue(base.content, note.content));
  const editor = usePlateEditor({ plugins: diffPlugins, value: diffValue });
  const store = useNoteBaselineStore();
  const { confirmSaved, markEdited, seedBaseline } = store.getState();

  const save = useMutation({
    mutationFn: async () => {
      const baseline = store.getState();
      const editSeq = baseline.editSeq;
      const content = plateToMarkdown(editor, stripDiffValue(editor.children));
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
    },
    onError: async (error) => {
      if (ServerFnError.is(error) && error.status === STALE_NOTE_VERSION_STATUS) {
        await queryClient.invalidateQueries({ queryKey: noteQuery.queryKey });

        const fresh = queryClient.getQueryData(noteQuery.queryKey);

        if (!fresh) return;

        seedBaseline({
          baseVersionId: fresh.lastAuthor === "user" ? fresh.versionId : null,
          contentHash: fresh.contentHash,
        });

        return;
      }

      toast.error(gt("Failed to save the note"));
    },
  });
  const saveDebounced = useDebouncedCallback(save.mutate, DIFF_SAVE_DEBOUNCE_MS, {
    flushOnExit: true,
    maxWait: DIFF_SAVE_MAX_WAIT_MS,
  });

  const counts = useMemo(
    () => diffWordCounts(markdownToText(base.content), markdownToText(note.content)),
    [base.content, note.content],
  );

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
      <NoteDiffBar counts={counts} noteId={noteId} selectedVersionId={baseVersionId}>
        <Button nativeButton={false} render={<Link search={clearNoteDiff} to="." />} size="xs">
          <T>Close</T>
        </Button>
      </NoteDiffBar>
    </NotePlate>
  );
};
