export const topicKeys = {
  all: ["topics"] as const,
  artifacts: (topicId: string) =>
    [...topicKeys.all, topicId, "artifacts"] as const,
};
