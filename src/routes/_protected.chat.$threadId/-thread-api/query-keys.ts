export type MentionQueryType = "file" | "thread" | "topic";

export const threadKeys = {
  all: ["threads"] as const,
  byId: (threadId: string) => [...threadKeys.all, threadId] as const,
  mentions: (topicId: string) => [...threadKeys.all, topicId, "mentions"] as const,
  mention: (type: MentionQueryType, id: string) =>
    [...threadKeys.all, "mention", type, id] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
  sidebarConversations: () => [...threadKeys.sidebar(), "conversations"] as const,
  sidebarTopics: () => [...threadKeys.sidebar(), "topics"] as const,
  sidebarTopicThreads: (topicId: string) =>
    [...threadKeys.sidebar(), "topics", topicId, "threads"] as const,
};

export const threadMutationKeys = {
  all: ["thread-mutation"] as const,
  uploadFile: (threadId: string) => [...threadMutationKeys.all, "upload-file", threadId] as const,
  addAttachment: (threadId: string) =>
    [...threadMutationKeys.all, "add-attachment", threadId] as const,
};
