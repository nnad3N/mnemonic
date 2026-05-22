export const threadKeys = {
  all: ["threads"] as const,
  messages: (threadId: string) =>
    [...threadKeys.all, "messages", threadId] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
};
