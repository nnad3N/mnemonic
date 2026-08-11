export type MentionQueryType = "file" | "thread" | "topic";

export const threadKeys = {
  all: ["threads"] as const,
  chat: (threadId: string) => [...threadKeys.all, threadId, "chat"] as const,
  mentions: (topicId: string) => [...threadKeys.all, topicId, "mentions"] as const,
  mention: (type: MentionQueryType, id: string) =>
    [...threadKeys.all, "mention", type, id] as const,
  settings: (threadId: string) => [...threadKeys.all, threadId, "settings"] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
  sidebarTopics: () => [...threadKeys.sidebar(), "topics"] as const,
  sidebarThreads: (topicId: string | undefined) =>
    [...threadKeys.sidebar(), "threads", topicId] as const,
};

export const threadMutationKeys = {
  all: ["thread-mutation"] as const,
  uploadFile: (threadId: string) => [...threadMutationKeys.all, "upload-file", threadId] as const,
};
