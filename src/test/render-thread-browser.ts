import { Chat } from "@ai-sdk/react";
import { nanoid } from "nanoid";
import { render } from "vitest-browser-react";

import { threadChatQuery } from "@/routes/_protected.chat.$threadId/-hooks/use-thread-chat";
import { threadSettingsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/settings";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { createTestQueryClient } from "@/test/create-test-query-client";
import { createProviderTree } from "@/test/create-test-router";

export const renderThreadBrowser = async (messages: ThreadUIMessage[]) => {
  const threadId = nanoid();
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(threadChatQuery(threadId).queryKey, {
    chat: new Chat({
      id: threadId,
      messages,
    }),
    resourceId: "user_test",
    topicId: undefined,
  });
  queryClient.setQueryData(threadSettingsQuery(threadId).queryKey, {
    modelCapability: "standard",
  });

  const { router, tree } = createProviderTree({ queryClient });
  await render(tree);
  await router.navigate({ to: "/chat/$threadId", params: { threadId } });

  return { queryClient, router, threadId };
};
