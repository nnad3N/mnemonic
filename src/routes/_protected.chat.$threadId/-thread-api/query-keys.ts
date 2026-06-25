export const threadKeys = {
  all: ["threads"] as const,
  artifacts: (topicId: string) =>
    [...threadKeys.all, topicId, "artifacts"] as const,
  byId: (threadId: string) => [...threadKeys.all, threadId] as const,
  mentions: (topicId?: string) =>
    [...threadKeys.all, topicId ?? "global", "mentions"] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
  topic: (topicId: string) => [...threadKeys.all, topicId, "topic"] as const,
};

export const threadMutationKeys = {
  all: ["thread-mutation"] as const,
  uploadArtifact: (threadId: string) =>
    [...threadMutationKeys.all, "upload-artifact", threadId] as const,
};
