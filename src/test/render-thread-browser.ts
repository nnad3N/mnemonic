import { nanoid } from "nanoid";
import { render } from "vitest-browser-react";

import { threadQuery } from "@/routes/_protected.chat.$threadId/-thread-api/get-thread";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { createProviderTree } from "@/test/create-test-router";
import { createTestQueryClient } from "@/test/create-test-query-client";

export const renderThreadBrowser = async (messages: ThreadUIMessage[]) => {
  const threadId = nanoid();
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(threadQuery(threadId).queryKey, {
    resourceId: "user_test",
    topicId: undefined,
    messages,
  });

  const { router, tree } = createProviderTree({ queryClient });
  await render(tree);
  await router.navigate({ to: "/chat/$threadId", params: { threadId } });

  return { queryClient, router, threadId };
};
