import { useQuery } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { sidebarTopicsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import { ThreadHeader } from "@/routes/_protected.chat.$threadId/-thread-components/thread-header";

export const AppHeader = () => {
  const chat = useMatch({ from: "/_protected/chat/$threadId", shouldThrow: false });
  const settings = useMatch({ from: "/_protected/settings", shouldThrow: false });
  const topicFiles = useMatch({ from: "/_protected/topic/$topicId/files", shouldThrow: false });

  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-1 overflow-hidden border-b border-foreground/3 bg-background/50 px-2 text-sm backdrop-blur md:h-10 dark:border-white/5">
      <SidebarTrigger className="shrink-0" />
      {chat && <ThreadHeader threadId={chat.params.threadId} />}
      {settings && (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap gap-0.5 overflow-hidden sm:gap-0.5">
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate px-1.5">
                <T>Settings</T>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
      {topicFiles && <TopicFilesCrumbs topicId={topicFiles.params.topicId} />}
    </header>
  );
};

type TopicFilesCrumbsProps = {
  topicId: string;
};

const TopicFilesCrumbs = ({ topicId }: TopicFilesCrumbsProps) => {
  const topic = useQuery({
    ...sidebarTopicsQuery(),
    select: (listed) => listed.find((topic) => topic.id === topicId),
  });

  if (!topic.isSuccess) {
    return <Skeleton className="h-4 w-40" />;
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-0.5 overflow-hidden sm:gap-0.5">
        {topic.data && (
          <>
            <BreadcrumbItem className="max-w-[45%] min-w-0 shrink">
              <span className="truncate px-1.5">{topic.data.title}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0" />
          </>
        )}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate px-1.5">
            <T>Files</T>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};
