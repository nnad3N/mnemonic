export const threadKeys = {
  all: ["threads"] as const,
  sidebar: () => [...threadKeys.all, "sidebar"] as const,
};
