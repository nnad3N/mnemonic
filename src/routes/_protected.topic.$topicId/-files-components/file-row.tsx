import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT, useLocale } from "gt-tanstack-start";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  FileIcon,
  PencilIcon,
  RotateCcwIcon,
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
import type { FileStatus } from "@/db/schema.server";
import type { GT } from "@/lib/gt";
import { cn } from "@/lib/utils";
import { retryFile } from "@/routes/_protected.chat.$threadId/-thread-api/files.functions";
import { mentionQueries } from "@/routes/_protected.chat.$threadId/-thread-api/mentions.functions";
import { getFileDownloadUrl } from "@/routes/_protected.topic.$topicId/-files/files.functions";
import type { FileItem } from "@/routes/_protected.topic.$topicId/-files/files.functions";
import { fileQueries, renameFile } from "@/routes/_protected.topic.$topicId/-files/files.functions";

import { DeleteFileDialog } from "./delete-file-dialog";

type FileRowProps = {
  file: FileItem;
  topicId: string;
};

const KILOBYTE = 1000;
const MEGABYTE = KILOBYTE * KILOBYTE;

const formatFileSize = (locale: string, sizeBytes: number) => {
  const inMegabytes = sizeBytes >= MEGABYTE;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: inMegabytes ? "megabyte" : "kilobyte",
  }).format(sizeBytes / (inMegabytes ? MEGABYTE : KILOBYTE));
};

const formatFileDate = (locale: string, createdAt: Date) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(createdAt);

export const FileRow = ({ file, topicId }: FileRowProps) => {
  const gt = useGT();
  const locale = useLocale();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const queryClient = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: async () =>
      retryFile({
        data: { fileId: file.id },
      }),
    onError: () => {
      toast.error(gt("Could not process file"));
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: fileQueries.byTopic(topicId),
        }),
        queryClient.invalidateQueries({
          queryKey: mentionQueries.byId({ type: "file", id: file.id }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: mentionQueries.listBase(),
        }),
      ]);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async () =>
      getFileDownloadUrl({
        data: { fileId: file.id },
      }),
    onError: () => {
      toast.error(gt("Could not download file"));
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
        <TableCell>{formatFileSize(locale, file.sizeBytes)}</TableCell>
        <TableCell>{formatFileDate(locale, file.createdAt)}</TableCell>
        <TableCell className="p-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
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
                <T>Rename</T>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={file.status !== "ready" || downloadMutation.isPending}
                onClick={() => {
                  downloadMutation.mutate();
                }}
              >
                <DownloadIcon />
                <T>Download</T>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={file.status !== "failed" || retryMutation.isPending}
                onClick={() => {
                  retryMutation.mutate();
                }}
              >
                <RotateCcwIcon />
                <T>Retry</T>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDeleteOpen(true);
                }}
                variant="destructive"
              >
                <Trash2Icon />
                <T>Delete</T>
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
  const gt = useGT();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      await renameFile({
        data: { fileId: file.id, displayName },
      });
    },
    onError: () => {
      toast.error(gt("Could not rename file"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: fileQueries.byTopic(topicId),
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

const getStatusLabel = (gt: GT, status: FileStatus) => {
  switch (status) {
    case "uploading": {
      return gt("Uploading");
    }
    case "processing": {
      return gt("Processing");
    }
    case "failed": {
      return gt("Failed");
    }
    case "ready": {
      return gt("Ready");
    }
  }
};

const FileStatusChip = ({ status }: { status: FileStatus }) => {
  const gt = useGT();
  const label = getStatusLabel(gt, status);

  return (
    <Badge variant="outline">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          status === "ready" && "bg-f-green",
          status === "failed" && "bg-f-red",
          status === "uploading" && "bg-f-yellow",
          status === "processing" && "bg-f-blue",
        )}
      />
      {label}
    </Badge>
  );
};
