import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { getPendingFiles } from "../-files-api/get-pending-files";
import { useChatStore } from "../../-chat-store";
import { threadKeys } from "../../_protected.chat.$threadId/-thread-api/query-keys";

const POLL_MS = 2000;

type FilesSyncProps = {
  topicId: string;
};

export const FilesSync = ({ topicId }: FilesSyncProps) => {
  const queryClient = useQueryClient();
  const previousPendingFileIds = useRef<string[]>([]);
  const isPolling = useChatStore((state) => state.pollingTopicIds.has(topicId));
  const { data: pendingFiles } = useQuery({
    queryFn: async () =>
      getPendingFiles({
        data: { topicId },
      }),
    select: (data) => data.map((fileItem) => fileItem.id),
    queryKey: [topicId, "pending-files"] as const,
    refetchInterval: isPolling ? POLL_MS : false,
  });

  useEffect(() => {
    if (!pendingFiles) return;

    const { removePollingTopicId, addPollingTopicId } = useChatStore.getState();
    const removedFileIds = previousPendingFileIds.current.filter(
      (fileId) => !pendingFiles.includes(fileId),
    );

    previousPendingFileIds.current = pendingFiles;

    if (pendingFiles.length > 0) {
      addPollingTopicId(topicId);
    } else {
      removePollingTopicId(topicId);
    }

    for (const fileId of removedFileIds) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mention("file", fileId),
      });
    }

    if (removedFileIds.length > 0) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mentions(topicId),
      });

      void queryClient.invalidateQueries({
        queryKey: topicKeys.files(topicId),
      });
    }
  }, [queryClient, topicId, pendingFiles]);

  useEffect(() => {
    return () => {
      previousPendingFileIds.current = [];
      useChatStore.getState().removePollingTopicId(topicId);
    };
  }, [topicId]);

  return null;
};
