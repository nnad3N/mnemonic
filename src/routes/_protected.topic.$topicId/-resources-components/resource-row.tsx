import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  FileIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ResourceStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { getResourceDownloadUrl } from "@/routes/_protected.topic.$topicId/-resources-api/get-resource-download-url";
import type { ResourceItem } from "@/routes/_protected.topic.$topicId/-resources-api/list-resources";
import { renameResource } from "@/routes/_protected.topic.$topicId/-resources-api/rename-resource";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { DeleteResourceDialog } from "./delete-resource-dialog";

type ResourceRowProps = {
  resource: ResourceItem;
  topicId: string;
};

const formatResourceSize = (sizeBytes: number) =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "kilobyte",
    unitDisplay: "narrow",
  }).format(sizeBytes / 1024);

const formatResourceDate = (createdAt: Date) =>
  new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));

export const ResourceRow = ({ resource, topicId }: ResourceRowProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const downloadMutation = useMutation({
    mutationFn: async () =>
      getResourceDownloadUrl({
        data: { resourceId: resource.id },
      }),
    onError: () => {
      toast.error(m.resources_download_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: ({ url }) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.rel = "noopener";
      anchor.download = resource.displayName;
      anchor.click();
      anchor.remove();
    },
  });

  return (
    <>
      <TableRow className="group/resource-row">
        <TableCell>
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            {isRenaming ? (
              <RenameResourceField
                resource={resource}
                stopRenaming={() => {
                  setIsRenaming(false);
                }}
                topicId={topicId}
              />
            ) : (
              <span
                className="truncate font-medium"
                onDoubleClick={() => {
                  setIsRenaming(true);
                }}
              >
                {resource.displayName}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <ResourceStatusChip status={resource.status} />
        </TableCell>
        <TableCell>{formatResourceSize(resource.sizeBytes)}</TableCell>
        <TableCell>{formatResourceDate(resource.createdAt)}</TableCell>
        <TableCell className="p-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={m.common_actions()}
                  className="opacity-0 group-hover/resource-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setIsRenaming(true);
                }}
              >
                <PencilIcon />
                {m.common_rename()}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={
                  resource.status !== "ready" || downloadMutation.isPending
                }
                onClick={() => {
                  downloadMutation.mutate();
                }}
              >
                <DownloadIcon />
                {m.common_download()}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDeleteOpen(true);
                }}
                variant="destructive"
              >
                <Trash2Icon />
                {m.common_delete()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <DeleteResourceDialog
        resource={resource}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        topicId={topicId}
      />
    </>
  );
};

type RenameResourceFieldProps = {
  resource: ResourceItem;
  stopRenaming: () => void;
  topicId: string;
};

const RenameResourceField = ({
  resource,
  stopRenaming,
  topicId,
}: RenameResourceFieldProps) => {
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      await renameResource({
        data: { resourceId: resource.id, displayName },
      });
    },
    onError: () => {
      toast.error(m.resources_rename_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: topicKeys.resources(topicId),
      });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { displayName: resource.displayName },
    onSubmit: async ({ value }) => {
      const trimmed = value.displayName.trim();

      if (trimmed.length === 0 || trimmed === resource.displayName.trim()) {
        stopRenaming();
        return;
      }

      renameMutation.mutate(trimmed);
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        displayName: v.string(),
      }),
    },
  });

  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <form.Field name="displayName">
        {(field) => (
          <Input
            autoFocus
            disabled={renameMutation.isPending}
            name={field.name}
            onBlur={async () => {
              field.handleBlur();
              await form.handleSubmit();
            }}
            onChange={(e) => {
              field.handleChange(e.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                stopRenaming();
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
    </form>
  );
};

const getStatusLabel = (status: ResourceStatus) => {
  // oxlint-disable-next-line default-case
  switch (status) {
    case "uploading": {
      return m.common_uploading();
    }
    case "processing": {
      return m.common_processing();
    }
    case "failed": {
      return m.common_failed();
    }
    case "ready": {
      return m.common_ready();
    }
  }
};

const ResourceStatusChip = ({ status }: { status: ResourceStatus }) => {
  const label = getStatusLabel(status);

  return (
    <Badge variant="outline">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          status === "ready" && "bg-green-500",
          status === "failed" && "bg-red-500",
          status === "uploading" && "bg-yellow-500",
          status === "processing" && "bg-blue-500"
        )}
      />
      {label}
    </Badge>
  );
};
