export type SidebarThread = {
  id: string;
  title: string;
  updatedAt: string;
};

export type SidebarTopic = {
  hasMoreThreads: boolean;
  id: string;
  nextThreadsPage: number | null;
  title: string;
  threads: SidebarThread[];
};
