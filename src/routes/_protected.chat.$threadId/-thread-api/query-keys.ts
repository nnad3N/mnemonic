export const threadKeys = {
  all: ["threads"] as const,
  byId: (threadId: string) => [...threadKeys.all, threadId] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
};

export const threadMutationKeys = {
  all: ["thread-mutation"] as const,
  uploadFile: (threadId: string) =>
    [...threadMutationKeys.all, "upload-file", threadId] as const,
};
