export const threadKeys = {
  all: ["threads"] as const,
  byId: (threadId: string) => [...threadKeys.all, threadId] as const,
  mentions: (topicId: string) =>
    [...threadKeys.all, topicId, "mentions"] as const,
  mention: (key: { topicId: string; artifactId: string }) =>
    [...threadKeys.mentions(key.topicId), key.artifactId] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
};

export const threadMutationKeys = {
  all: ["thread-mutation"] as const,
  uploadArtifact: (threadId: string) =>
    [...threadMutationKeys.all, "upload-artifact", threadId] as const,
  addAttachment: (threadId: string) =>
    [...threadMutationKeys.all, "add-attachment", threadId] as const,
};
