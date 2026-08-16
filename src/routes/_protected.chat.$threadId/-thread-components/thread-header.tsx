import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { panic } from "better-result";
import { T } from "gt-tanstack-start";
import { FileIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
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
  threadId: string;
};

export const ThreadHeader = ({ threadId }: ThreadHeaderProps) => {
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
    enabled: topicId !== undefined,
    select: (listed) => listed.find((topic) => topic.id === topicId),
  });
  const isReady = thread.isSuccess && (!topic.isEnabled || topic.isSuccess);

  if (!isReady) {
    return <Skeleton className="h-4 w-40" />;
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-0.5 overflow-hidden sm:gap-0.5">
        {topic.data && (
          <BreadcrumbItem className="max-w-[45%] min-w-0 shrink">
            <TopicCrumb title={topic.data.title} topicId={topic.data.id} />
          </BreadcrumbItem>
        )}
        {topic.data && thread.data && <BreadcrumbSeparator className="shrink-0" />}
        {thread.data && (
          <BreadcrumbItem className="min-w-0 shrink">
            <ThreadCrumb threadId={threadId} title={thread.data} />
          </BreadcrumbItem>
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
              className="truncate rounded-md px-1.5 py-1.5 hover:bg-accent hover:text-accent-foreground"
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
      <button
        aria-current="page"
        className="truncate rounded-md px-1.5 py-1.5 font-normal text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        type="button"
      />
    }
    threadId={threadId}
    title={title}
  >
    {title}
  </ThreadContextMenu>
);
