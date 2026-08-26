import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { produce } from "immer";
import { useEffect } from "react";

import type { ThreadRunEvent } from "@/lib/durable-agents-kit.server";

import { deleteThreadRun, threadRunQueries } from "../-thread-api/thread-run.functions";

const queryKey = threadRunQueries.states().queryKey;

export const useSyncRunStates = () => {
  useSuspenseQuery(threadRunQueries.states());
  const queryClient = useQueryClient();
  const router = useRouter();
  const threadId = useParams({ strict: false, select: (params) => params.threadId });

  const { mutate: dismissRun } = useMutation({
    mutationFn: async (runThreadId: string) => deleteThreadRun({ data: { threadId: runThreadId } }),
    retry: 3,
    onMutate: (runThreadId) => {
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (states) =>
        states?.filter((state) => state.threadId !== runThreadId),
      );

      return { previous };
    },
    onError: (_error, _runThreadId, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
  });

  useEffect(() => {
    if (!threadId) return;

    const settled = queryClient
      .getQueryData(queryKey)
      ?.some((state) => state.threadId === threadId && state.status !== "running");

    if (settled) {
      dismissRun(threadId);
    }
  }, [dismissRun, queryClient, threadId]);

  useEffect(() => {
    const source = new EventSource("/api/run-events");
    let opened = false;

    source.onopen = () => {
      // Events missed while disconnected are already in the DB.
      if (opened) {
        void queryClient.invalidateQueries({ queryKey });
      }

      opened = true;
    };

    source.onmessage = (message: MessageEvent<string>) => {
      // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion
      const event = JSON.parse(message.data) as ThreadRunEvent;

      queryClient.setQueryData(
        queryKey,
        (states) =>
          states &&
          produce(states, (draft) => {
            const state = draft.find((entry) => entry.threadId === event.threadId);

            if (state) {
              state.status = event.status;
              return;
            }

            draft.push(event);
          }),
      );

      const isOpen = router.matchRoute({
        to: "/chat/$threadId",
        params: { threadId: event.threadId },
      });

      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (event.status === "aborted" || (event.status !== "running" && isOpen)) {
        dismissRun(event.threadId);
      }
    };

    return () => {
      source.close();
    };
  }, [dismissRun, queryClient, router]);
};
