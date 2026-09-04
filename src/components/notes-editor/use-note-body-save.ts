import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useStore } from "zustand/react";

import { ServerFnError } from "@/lib/errors/server-fn-error";
import { hashText } from "@/lib/hash";
import {
  STALE_NOTE_VERSION_STATUS,
  noteQueries,
  saveNoteBody,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
import type { NoteDetail } from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { useNoteBaselineStore } from "./notes-store";

const BODY_SAVE_DEBOUNCE_MS = 300;
const BODY_SAVE_MAX_WAIT_MS = 1000;

type UseNoteBodySaveInput = {
  noteId: string;
  /** Called with the note another tab moved to, after the baseline reseeds onto it. */
  onStale?: (fresh: NoteDetail) => void;
  serialize: () => string;
};

export const useNoteBodySave = ({ noteId, onStale, serialize }: UseNoteBodySaveInput) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const noteQuery = noteQueries.byId(noteId);
  const { data: note } = useSuspenseQuery(noteQuery);
  const store = useNoteBaselineStore();
  const confirmSaved = useStore(store, (state) => state.confirmSaved);
  const markEdited = useStore(store, (state) => state.markEdited);
  const seedBaseline = useStore(store, (state) => state.seedBaseline);
  const saveMutationKey = [...noteQuery.queryKey, "body"] as const;

  const save = useMutation({
    mutationKey: saveMutationKey,
    mutationFn: async () => {
      // The count includes this call, so above one means an earlier save is still in flight.
      if (queryClient.isMutating({ mutationKey: saveMutationKey }) > 1) return;

      const baseline = store.getState();
      const editSeq = baseline.editSeq;
      const content = serialize();
      const contentHash = await hashText(content);

      if (contentHash === baseline.contentHash) {
        confirmSaved(editSeq, { baseVersionId: baseline.baseVersionId, contentHash });

        return;
      }

      const saved = await saveNoteBody({
        data: baseline.baseVersionId
          ? { intent: "overwrite", baseVersionId: baseline.baseVersionId, content, noteId }
          : { intent: "append", content, noteId },
      });

      confirmSaved(editSeq, { baseVersionId: saved.versionId, contentHash: saved.contentHash });

      if (saved.isLatest) {
        queryClient.setQueryData(noteQuery.queryKey, (previous) =>
          produce(previous, (draft) => {
            if (!draft) return;

            draft.baseVersionId = saved.versionId;
            draft.content = content;
            draft.contentHash = saved.contentHash;
            draft.pendingReviewBaseVersionId = null;
            draft.versionId = saved.versionId;
          }),
        );
      }

      void queryClient.invalidateQueries({ queryKey: noteQueries.versionLists(noteId) });
    },
    onError: async (error) => {
      if (ServerFnError.is(error) && error.status === STALE_NOTE_VERSION_STATUS) {
        // Another tab moved the chain; that tab's state wins and this editor reseeds onto it.
        await queryClient.invalidateQueries({ queryKey: noteQuery.queryKey });

        const fresh = queryClient.getQueryData(noteQuery.queryKey);

        if (!fresh) return;

        seedBaseline({ baseVersionId: fresh.baseVersionId, contentHash: fresh.contentHash });
        onStale?.(fresh);

        return;
      }

      toast.error(gt("Failed to save the note"));
    },
  });
  const saveDebounced = useDebouncedCallback(save.mutate, BODY_SAVE_DEBOUNCE_MS, {
    flushOnExit: true,
    maxWait: BODY_SAVE_MAX_WAIT_MS,
  });

  return {
    flushSave: saveDebounced.flush,
    scheduleSave: () => {
      markEdited(note.pendingReviewBaseVersionId ? note.versionId : null);
      saveDebounced();
    },
  };
};
