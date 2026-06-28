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
import type { ArtifactStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { getArtifactDownloadUrl } from "@/routes/_protected.topic.$topicId/-artifacts-api/get-artifact-download-url";
import type { ArtifactItem } from "@/routes/_protected.topic.$topicId/-artifacts-api/list-artifacts";
import { renameArtifact } from "@/routes/_protected.topic.$topicId/-artifacts-api/rename-artifact";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { DeleteArtifactDialog } from "./delete-artifact-dialog";

type ArtifactRowProps = {
  artifact: ArtifactItem;
  topicId: string;
};

const formatArtifactSize = (sizeBytes: number) =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "kilobyte",
    unitDisplay: "narrow",
  }).format(sizeBytes / 1024);

const formatArtifactDate = (createdAt: Date) =>
  new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));

export const ArtifactRow = ({ artifact, topicId }: ArtifactRowProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const downloadMutation = useMutation({
    mutationFn: async () =>
      getArtifactDownloadUrl({
        data: { artifactId: artifact.id, topicId },
      }),
    onError: () => {
      toast.error(m.artifacts_download_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: ({ url }) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.rel = "noopener";
      anchor.download = artifact.displayName;
      anchor.click();
      anchor.remove();
    },
  });

  return (
    <>
      <TableRow className="group/artifact-row">
        <TableCell>
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            {isRenaming ? (
              <RenameArtifactField
                artifact={artifact}
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
                {artifact.displayName}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <ArtifactStatusChip status={artifact.status} />
        </TableCell>
        <TableCell>{formatArtifactSize(artifact.sizeBytes)}</TableCell>
        <TableCell>{formatArtifactDate(artifact.createdAt)}</TableCell>
        <TableCell className="p-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={m.common_actions()}
                  className="opacity-0 group-hover/artifact-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
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
                  artifact.status !== "ready" || downloadMutation.isPending
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

      <DeleteArtifactDialog
        artifact={artifact}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        topicId={topicId}
      />
    </>
  );
};

type RenameArtifactFieldProps = {
  artifact: ArtifactItem;
  stopRenaming: () => void;
  topicId: string;
};

const RenameArtifactField = ({
  artifact,
  stopRenaming,
  topicId,
}: RenameArtifactFieldProps) => {
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      await renameArtifact({
        data: { artifactId: artifact.id, displayName, topicId },
      });
    },
    onError: () => {
      toast.error(m.artifacts_rename_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: topicKeys.artifacts(topicId),
      });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { displayName: artifact.displayName },
    onSubmit: async ({ value }) => {
      const trimmed = value.displayName.trim();

      if (trimmed.length === 0 || trimmed === artifact.displayName.trim()) {
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

const getStatusLabel = (status: ArtifactStatus) => {
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

const ArtifactStatusChip = ({ status }: { status: ArtifactStatus }) => {
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
