export const topicKeys = {
  all: ["topics"] as const,
  files: (topicId: string) => [...topicKeys.all, topicId, "files"] as const,
};
