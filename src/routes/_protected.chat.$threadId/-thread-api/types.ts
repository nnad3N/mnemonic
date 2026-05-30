export type SidebarThread = {
  id: string;
  title: string;
  updatedAt: string;
};

export type SidebarTopic = {
  id: string;
  title: string;
  threads: SidebarThread[];
};
