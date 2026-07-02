export const topicKeys = {
  all: ["topics"] as const,
  resources: (topicId: string) =>
    [...topicKeys.all, topicId, "resources"] as const,
};
