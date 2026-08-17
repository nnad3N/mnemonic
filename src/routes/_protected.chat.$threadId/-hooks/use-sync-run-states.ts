import { useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { useEffect } from "react";

import { streamThreadRunEvents, threadRunQueries } from "../-thread-api/thread-run.functions";

export const useSyncRunStates = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const controller = new AbortController();
    const queryKey = threadRunQueries.states().queryKey;

    void (async () => {
      for await (const event of await streamThreadRunEvents({ signal: controller.signal })) {
        queryClient.setQueryData(queryKey, (states = []) =>
          produce(states, (draft) => {
            const state = draft.find((entry) => entry.threadId === event.threadId);

            if (state) {
              state.status = event.status;
              state.finishedAt = event.finishedAt;
              return;
            }

            draft.push({ ...event, viewedAt: null });
          }),
        );
      }
    })();

    return () => {
      controller.abort();
    };
  }, [queryClient]);
};
