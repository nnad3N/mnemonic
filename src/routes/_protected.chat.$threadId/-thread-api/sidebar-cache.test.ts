import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { moveSidebarThreadToTop } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-cache";
import {
  sidebarConversationsQuery,
  sidebarTopicsQuery,
  sidebarTopicThreadsQuery,
} from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import type { SidebarThread } from "@/routes/_protected.chat.$threadId/-thread-api/types";

const TOPIC_ID = "topic-1";

const thread = (id: string): SidebarThread => ({
  id,
  title: id,
  updatedAt: "2020-01-01T00:00:00.000Z",
});

const threadsPage = (ids: string[], nextPage: number | null) => ({
  hasMore: nextPage !== null,
  items: ids.map(thread),
  nextPage,
});

const seed = () => {
  const queryClient = new QueryClient();

  queryClient.setQueryData(sidebarConversationsQuery().queryKey, {
    pageParams: [0, 1],
    pages: [threadsPage(["a", "b"], 1), threadsPage(["c", "d"], null)],
  });
  queryClient.setQueryData(sidebarTopicThreadsQuery(TOPIC_ID).queryKey, {
    pageParams: [0, 1],
    pages: [threadsPage(["t1", "t2"], 1), threadsPage(["t3"], null)],
  });
  queryClient.setQueryData(sidebarTopicsQuery().queryKey, {
    pageParams: [0],
    pages: [
      {
        hasMore: false,
        items: [
          {
            hasMoreThreads: false,
            id: TOPIC_ID,
            nextThreadsPage: null,
            threads: [thread("t1"), thread("t2"), thread("t3")],
            title: "Topic",
          },
          {
            hasMoreThreads: false,
            id: "topic-2",
            nextThreadsPage: null,
            threads: [thread("other")],
            title: "Other",
          },
        ],
      },
    ],
  });

  return queryClient;
};

const conversationIds = (queryClient: QueryClient) =>
  queryClient
    .getQueryData(sidebarConversationsQuery().queryKey)
    ?.pages.map((page) => page.items.map((item) => item.id));

const topicThreadIds = (queryClient: QueryClient) =>
  queryClient
    .getQueryData(sidebarTopicThreadsQuery(TOPIC_ID).queryKey)
    ?.pages.map((page) => page.items.map((item) => item.id));

const nestedTopicThreadIds = (queryClient: QueryClient, topicId: string) =>
  queryClient
    .getQueryData(sidebarTopicsQuery().queryKey)
    ?.pages.at(0)
    ?.items.find((item) => item.id === topicId)
    ?.threads.map((item) => item.id);

describe("moveSidebarThreadToTop", () => {
  it("floats a conversation from a later page to the top of the first page", () => {
    const queryClient = seed();

    moveSidebarThreadToTop(queryClient, { threadId: "d", topicId: undefined });

    expect(conversationIds(queryClient)).toEqual([["d", "a", "b"], ["c"]]);
  });

  it("stamps the moved conversation with a fresh updatedAt", () => {
    const queryClient = seed();

    moveSidebarThreadToTop(queryClient, { threadId: "b", topicId: undefined });

    const moved = queryClient
      .getQueryData(sidebarConversationsQuery().queryKey)
      ?.pages.at(0)
      ?.items.at(0);

    expect(moved?.id).toBe("b");
    expect(moved?.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("floats a topic thread in both the topic threads and the nested topics cache", () => {
    const queryClient = seed();

    moveSidebarThreadToTop(queryClient, { threadId: "t3", topicId: TOPIC_ID });

    expect(topicThreadIds(queryClient)).toEqual([["t3", "t1", "t2"], []]);
    expect(nestedTopicThreadIds(queryClient, TOPIC_ID)).toEqual(["t3", "t1", "t2"]);
    expect(nestedTopicThreadIds(queryClient, "topic-2")).toEqual(["other"]);
    expect(conversationIds(queryClient)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("leaves the caches untouched for an unknown thread", () => {
    const queryClient = seed();

    moveSidebarThreadToTop(queryClient, { threadId: "missing", topicId: undefined });
    moveSidebarThreadToTop(queryClient, { threadId: "missing", topicId: TOPIC_ID });

    expect(conversationIds(queryClient)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(topicThreadIds(queryClient)).toEqual([["t1", "t2"], ["t3"]]);
    expect(nestedTopicThreadIds(queryClient, TOPIC_ID)).toEqual(["t1", "t2", "t3"]);
  });
});
