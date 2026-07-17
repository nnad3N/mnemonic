import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, EllipsisVerticalIcon, FileIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import type { FileStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { getFileDownloadUrl } from "@/routes/_protected.topic.$topicId/-files-api/get-file-download-url";
import type { FileItem } from "@/routes/_protected.topic.$topicId/-files-api/list-files";
import { renameFile } from "@/routes/_protected.topic.$topicId/-files-api/rename-file";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { DeleteFileDialog } from "./delete-file-dialog";

type FileRowProps = {
  file: FileItem;
  topicId: string;
};

const formatFileSize = (sizeBytes: number) =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "kilobyte",
    unitDisplay: "narrow",
  }).format(sizeBytes / 1024);

const formatFileDate = (createdAt: Date) =>
  new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));

export const FileRow = ({ file, topicId }: FileRowProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const downloadMutation = useMutation({
    mutationFn: async () =>
      getFileDownloadUrl({
        data: { fileId: file.id },
      }),
    onError: () => {
      toast.error(m.files_download_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: ({ url }) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.rel = "noopener";
      anchor.download = file.displayName;
      anchor.click();
      anchor.remove();
    },
  });

  return (
    <>
      <TableRow className="group/file-row">
        <TableCell>
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            {isRenaming ? (
              <RenameFileField
                file={file}
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
                {file.displayName}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <FileStatusChip status={file.status} />
        </TableCell>
        <TableCell>{formatFileSize(file.sizeBytes)}</TableCell>
        <TableCell>{formatFileDate(file.createdAt)}</TableCell>
        <TableCell className="p-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={m.common_actions()}
                  className="opacity-0 group-hover/file-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
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
                disabled={file.status !== "ready" || downloadMutation.isPending}
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

      <DeleteFileDialog
        file={file}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        topicId={topicId}
      />
    </>
  );
};

type RenameFileFieldProps = {
  file: FileItem;
  stopRenaming: () => void;
  topicId: string;
};

const RenameFileField = ({ file, stopRenaming, topicId }: RenameFileFieldProps) => {
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      await renameFile({
        data: { fileId: file.id, displayName },
      });
    },
    onError: () => {
      toast.error(m.files_rename_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: topicKeys.files(topicId),
      });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { displayName: file.displayName },
    onSubmit: ({ value }) => {
      const trimmed = value.displayName.trim();

      if (trimmed.length === 0 || trimmed === file.displayName.trim()) {
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

const getStatusLabel = (status: FileStatus) => {
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

const FileStatusChip = ({ status }: { status: FileStatus }) => {
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
          status === "processing" && "bg-blue-500",
        )}
      />
      {label}
    </Badge>
  );
};
