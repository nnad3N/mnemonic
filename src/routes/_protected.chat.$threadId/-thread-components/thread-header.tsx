import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch } from "@tanstack/react-router";
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
import {
  sidebarThreadsQuery,
  sidebarTopicsQuery,
} from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";

import {
  DeleteThreadDialog,
  DeleteTopicDialog,
  RenameThreadField,
  RenameTopicField,
} from "./thread-actions";

export const ThreadHeader = () => {
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const topicId = useSearch({
    from: "/_protected",
    select: (search) => search.topic,
  });
  const thread = useQuery({
    ...sidebarThreadsQuery(topicId),
    select: (listed) => listed.find((thread) => thread.id === threadId)?.title,
  });
  const topic = useQuery({
    ...sidebarTopicsQuery(),
    enabled: topicId !== undefined,
    select: (listed) => listed.find((topic) => topic.id === topicId),
  });
  const isReady = thread.isSuccess && (!topic.isEnabled || topic.isSuccess);

  return (
    <header className="sticky top-0 z-10 flex items-center border-b border-foreground/3 bg-background/50 p-2 text-sm backdrop-blur dark:border-white/5">
      {isReady ? (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap gap-0.5 sm:gap-0.5">
            {topic.data && (
              <>
                <BreadcrumbItem className="min-w-0">
                  <TopicCrumb title={topic.data.title} topicId={topic.data.id} />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem className="min-w-0">
              <ThreadCrumb threadId={threadId} title={thread.data ?? ""} />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <Skeleton className="h-4 w-40" />
      )}
    </header>
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
              className="truncate rounded-md px-1.5 py-1 hover:bg-accent hover:text-accent-foreground"
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

const ThreadCrumb = ({ threadId, title }: ThreadCrumbProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isRenaming) {
    return (
      <RenameThreadField
        initialValue={title}
        onCancel={() => {
          setIsRenaming(false);
        }}
        threadId={threadId}
      />
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              aria-current="page"
              className="rounded-md px-1.5 py-1 font-normal text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              type="button"
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
            <T>Rename</T>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setDeleteOpen(true);
            }}
            variant="destructive"
          >
            <Trash2Icon />
            <T>Delete</T>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteThreadDialog onOpenChange={setDeleteOpen} open={deleteOpen} threadId={threadId} />
    </>
  );
};
