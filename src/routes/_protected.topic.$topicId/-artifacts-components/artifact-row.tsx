import { useMutation } from "@tanstack/react-query";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  FileIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ArtifactStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { getArtifactDownloadUrl } from "@/routes/_protected.topic.$topicId/-artifacts-api/get-artifact-download-url";
import type { ArtifactItem } from "@/routes/_protected.topic.$topicId/-artifacts-api/list-artifacts";

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

  const downloadMutation = useMutation({
    mutationFn: async () =>
      getArtifactDownloadUrl({
        data: { artifactId: artifact.id, topicId },
      }),
    onError: () => {
      toast.error(m.artifacts_download_error_title(), {
        description: m.artifacts_download_error_description(),
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
            <span className="truncate font-medium">{artifact.displayName}</span>
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
                  aria-label={m.artifacts_column_actions()}
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
                disabled={
                  artifact.status !== "ready" || downloadMutation.isPending
                }
                onClick={() => {
                  downloadMutation.mutate();
                }}
              >
                <DownloadIcon />
                {m.artifacts_download()}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDeleteOpen(true);
                }}
                variant="destructive"
              >
                <Trash2Icon />
                {m.artifacts_delete()}
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

const getStatusLabel = (status: ArtifactStatus) => {
  // oxlint-disable-next-line default-case
  switch (status) {
    case "uploading": {
      return m.artifacts_status_uploading();
    }
    case "processing": {
      return m.artifacts_status_processing();
    }
    case "failed": {
      return m.artifacts_status_failed();
    }
    case "ready": {
      return m.artifacts_status_ready();
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
