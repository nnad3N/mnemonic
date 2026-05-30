export const threadKeys = {
  all: ["threads"] as const,
  byId: (threadId: string) => [...threadKeys.all, threadId] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
};
