import { useQuery } from "@tanstack/react-query";
import { Link, useMatch } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";
import type { PropsWithChildren } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { sidebarTopicsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import { ThreadHeader } from "@/routes/_protected.chat.$threadId/-thread-components/thread-header";
import { adminQueries } from "@/routes/_protected.settings_.admin/-admin-queries";

export const AppHeader = () => {
  const chat = useMatch({ from: "/_protected/chat/$threadId", shouldThrow: false });
  const settings = useMatch({ from: "/_protected/settings", shouldThrow: false });
  const topicFiles = useMatch({ from: "/_protected/topic/$topicId/files", shouldThrow: false });
  const admin = useMatch({ from: "/_protected/settings_/admin/", shouldThrow: false });
  const adminUserByok = useMatch({
    from: "/_protected/settings_/admin/$userId/byok",
    shouldThrow: false,
  });

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
      {admin && (
        <Crumbs>
          <SettingsCrumb />
          <BreadcrumbSeparator className="shrink-0" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate px-1.5">
              <T>Admin</T>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </Crumbs>
      )}
      {adminUserByok && <AdminByokCrumbs userId={adminUserByok.params.userId} />}
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

const Crumbs = ({ children }: PropsWithChildren) => (
  <Breadcrumb className="min-w-0">
    <BreadcrumbList className="flex-nowrap gap-0.5 overflow-hidden sm:gap-0.5">
      {children}
    </BreadcrumbList>
  </Breadcrumb>
);

const SettingsCrumb = () => (
  <BreadcrumbItem className="min-w-0">
    <BreadcrumbLink
      className="truncate rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground"
      render={<Link to="/settings" />}
    >
      <T>Settings</T>
    </BreadcrumbLink>
  </BreadcrumbItem>
);

type AdminByokCrumbsProps = {
  userId: string;
};

const AdminByokCrumbs = ({ userId }: AdminByokCrumbsProps) => {
  const owner = useQuery(adminQueries.user(userId));

  return (
    <Crumbs>
      <SettingsCrumb />
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          className="truncate rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground"
          render={<Link to="/settings/admin" />}
        >
          <T>Admin</T>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        {owner.isSuccess ? (
          <BreadcrumbPage className="truncate px-1.5">{owner.data.email}</BreadcrumbPage>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
      </BreadcrumbItem>
    </Crumbs>
  );
};
