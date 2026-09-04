import { Chat } from "@ai-sdk/react";
import { nanoid } from "nanoid";
import { render } from "vitest-browser-react";

import { threadQueries } from "@/routes/_protected.chat.$threadId/-hooks/use-thread-chat";
import { threadSettingsQueries } from "@/routes/_protected.chat.$threadId/-thread-api/thread-settings.functions";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { createTestQueryClient } from "@/test/create-test-query-client";
import { createProviderTree } from "@/test/create-test-router";

export const renderThreadBrowser = async (messages: ThreadUIMessage[]) => {
  const threadId = nanoid();
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(threadQueries.chat(threadId).queryKey, {
    chat: new Chat({
      id: threadId,
      messages,
    }),
    topicId: undefined,
  });
  queryClient.setQueryData(threadSettingsQueries.byThread(threadId).queryKey, {
    modelOption: "research",
  });

  const { router, tree } = createProviderTree({ queryClient });
  await render(tree);
  await router.navigate({ to: "/chat/$threadId", params: { threadId } });

  return { queryClient, router, threadId };
};
