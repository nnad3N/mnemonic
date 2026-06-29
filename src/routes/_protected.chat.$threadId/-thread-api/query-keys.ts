export const threadKeys = {
  all: ["threads"] as const,
  byId: (threadId: string) => [...threadKeys.all, threadId] as const,
  mentions: (topicId: string) =>
    [...threadKeys.all, topicId, "mentions"] as const,
  mention: (artifactId: string) =>
    [...threadKeys.all, "mention", artifactId] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
};

export const threadMutationKeys = {
  all: ["thread-mutation"] as const,
  uploadArtifact: (threadId: string) =>
    [...threadMutationKeys.all, "upload-artifact", threadId] as const,
  addAttachment: (threadId: string) =>
    [...threadMutationKeys.all, "add-attachment", threadId] as const,
};
