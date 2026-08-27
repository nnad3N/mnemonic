import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { panic } from "better-result";
import { T } from "gt-tanstack-start";
import { FileIcon, FileTextIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";

import { DeleteTopicDialog, RenameTopicField, ThreadContextMenu } from "./thread-actions";

type ThreadHeaderProps = {
  page?: ReactNode;
  threadId: string;
};

export const ThreadHeader = ({ page, threadId }: ThreadHeaderProps) => {
  const topicId = useSearch({
    from: "/_protected",
    select: (search) => search.topic,
  });
  const thread = useQuery({
    ...sidebarQueries.threads(topicId),
    select: (listed) =>
      listed.find((thread) => thread.id === threadId)?.title ??
      panic(`Thread ${threadId} missing from sidebar threads`),
  });
  const topic = useQuery({
    ...sidebarQueries.topics(),
    enabled: !!topicId,
    select: (listed) => listed.find((topic) => topic.id === topicId),
  });
  const isReady = thread.isSuccess && (!topic.isEnabled || topic.isSuccess);

  if (!isReady) {
    return <Skeleton className="h-4 w-40" />;
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-0.5 max-md:overflow-hidden sm:gap-0.5">
        {topic.data && (
          <BreadcrumbItem className="min-w-0 shrink max-md:max-w-[45%]">
            <TopicCrumb title={topic.data.title} topicId={topic.data.id} />
          </BreadcrumbItem>
        )}
        {topic.data && thread.data && <BreadcrumbSeparator className="shrink-0" />}
        {thread.data && (
          <BreadcrumbItem className="min-w-0 shrink">
            <ThreadCrumb threadId={threadId} title={thread.data} />
          </BreadcrumbItem>
        )}
        {page !== undefined && (
          <>
            <BreadcrumbSeparator className="shrink-0" />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="px-1.5 max-md:truncate">{page}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

type TopicCrumbProps = {
  title: string;
  topicId: string;
};

const TopicCrumb = ({ title, topicId }: TopicCrumbProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isRenaming) {
    return (
      <RenameTopicField
        initialValue={title}
        onCancel={() => {
          setIsRenaming(false);
        }}
        topicId={topicId}
      />
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <BreadcrumbLink
              className="rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground max-md:truncate"
              render={<Link params={{ topicId }} to="/topic/$topicId/files" />}
            />
          }
        >
          {title}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              setIsRenaming(true);
            }}
          >
            <PencilIcon />
            <T>Rename topic</T>
          </ContextMenuItem>
          <ContextMenuItem render={<Link params={{ topicId }} to="/topic/$topicId/files" />}>
            <FileIcon />
            <T>Files</T>
          </ContextMenuItem>
          <ContextMenuItem render={<Link params={{ topicId }} to="/topic/$topicId/notes" />}>
            <FileTextIcon />
            <T>Notes</T>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setDeleteOpen(true);
            }}
            variant="destructive"
          >
            <Trash2Icon />
            <T>Delete topic</T>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteTopicDialog onOpenChange={setDeleteOpen} open={deleteOpen} topicId={topicId} />
    </>
  );
};

type ThreadCrumbProps = {
  threadId: string;
  title: string;
};

const ThreadCrumb = ({ threadId, title }: ThreadCrumbProps) => (
  <ThreadContextMenu
    render={
      <BreadcrumbLink
        className="rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground max-md:truncate"
        render={<Link params={{ threadId }} to="/chat/$threadId" />}
      />
    }
    threadId={threadId}
    title={title}
  >
    {title}
  </ThreadContextMenu>
);
