import { useQuery } from "@tanstack/react-query";
import { Link, useMatch, useNavigate, useSearch } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";
import { produce } from "immer";
import { PanelRightIcon } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";
import { ThreadHeader } from "@/routes/_protected.chat.$threadId/-thread-components/thread-header";
import { adminQueries } from "@/routes/_protected.settings_.admin/-admin-queries";

export const AppHeader = () => {
  const chat = useMatch({ from: "/_protected/chat/$threadId", shouldThrow: false });
  const settings = useMatch({ from: "/_protected/settings", shouldThrow: false });
  const topicFiles = useMatch({ from: "/_protected/topic/$topicId/files", shouldThrow: false });
  const topicNotes = useMatch({ from: "/_protected/topic/$topicId/notes", shouldThrow: false });
  const threadNotes = useMatch({ from: "/_protected/chat/$threadId_/notes", shouldThrow: false });
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
          <BreadcrumbList className="flex-nowrap gap-0.5 max-md:overflow-hidden sm:gap-0.5">
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="px-1.5 max-md:truncate">
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
            <BreadcrumbPage className="px-1.5 max-md:truncate">
              <T>Admin</T>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </Crumbs>
      )}
      {adminUserByok && <AdminByokCrumbs userId={adminUserByok.params.userId} />}
      {topicFiles && <TopicCrumbs page={<T>Files</T>} topicId={topicFiles.params.topicId} />}
      {topicNotes && <TopicCrumbs page={<T>Notes</T>} topicId={topicNotes.params.topicId} />}
      {threadNotes && <ThreadHeader page={<T>Notes</T>} threadId={threadNotes.params.threadId} />}
      <NotesTrigger />
    </header>
  );
};

const NotesTrigger = () => {
  const navigate = useNavigate();
  const notesOpen = useSearch({ from: "/_protected", select: (search) => search.notes === true });

  if (notesOpen) return;

  return (
    <Button
      className="ml-auto shrink-0"
      onClick={async () =>
        navigate({
          search: (prev) =>
            produce(prev, (draft) => {
              draft.notes = true;
            }),
          to: ".",
        })
      }
      size="icon-sm"
      variant="ghost"
    >
      <PanelRightIcon />
      <span className="sr-only">
        <T>Open notes</T>
      </span>
    </Button>
  );
};

type TopicCrumbsProps = {
  page: ReactNode;
  topicId: string;
};

const TopicCrumbs = ({ page, topicId }: TopicCrumbsProps) => {
  const topic = useQuery({
    ...sidebarQueries.topics(),
    select: (listed) => listed.find((topic) => topic.id === topicId),
  });

  if (!topic.isSuccess) {
    return <Skeleton className="h-4 w-40" />;
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-0.5 max-md:overflow-hidden sm:gap-0.5">
        {topic.data && (
          <>
            <BreadcrumbItem className="min-w-0 shrink max-md:max-w-[45%]">
              <span className="px-1.5 max-md:truncate">{topic.data.title}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0" />
          </>
        )}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="px-1.5 max-md:truncate">{page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const Crumbs = ({ children }: PropsWithChildren) => (
  <Breadcrumb className="min-w-0">
    <BreadcrumbList className="flex-nowrap gap-0.5 max-md:overflow-hidden sm:gap-0.5">
      {children}
    </BreadcrumbList>
  </Breadcrumb>
);

const SettingsCrumb = () => (
  <BreadcrumbItem className="min-w-0">
    <BreadcrumbLink
      className="rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground max-md:truncate"
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
          className="rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground max-md:truncate"
          render={<Link to="/settings/admin" />}
        >
          <T>Admin</T>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        {owner.isSuccess ? (
          <BreadcrumbPage className="px-1.5 max-md:truncate">{owner.data.email}</BreadcrumbPage>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
      </BreadcrumbItem>
    </Crumbs>
  );
};
