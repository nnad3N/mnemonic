import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { mentionQueries } from "@/routes/_protected.chat.$threadId/-thread-api/mentions.functions";
import { fileQueries } from "@/routes/_protected.topic.$topicId/-files/files.functions";

import { useChatStore } from "../../-chat-store";

const POLL_MS = 2000;

type FilesSyncProps = {
  topicId: string;
};

export const FilesSync = ({ topicId }: FilesSyncProps) => {
  const queryClient = useQueryClient();
  const previousPendingFileIds = useRef<string[]>([]);
  const isPolling = useChatStore((state) => state.pollingTopicIds.has(topicId));
  const { data: pendingFiles } = useQuery({
    ...fileQueries.pending(topicId),
    select: (data) => data.map((fileItem) => fileItem.id),
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
        queryKey: mentionQueries.byId({ type: "file", id: fileId }).queryKey,
      });
    }

    if (removedFileIds.length > 0) {
      void queryClient.invalidateQueries({
        queryKey: mentionQueries.byResource(topicId),
      });

      void queryClient.invalidateQueries({
        queryKey: fileQueries.byTopic(topicId),
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
