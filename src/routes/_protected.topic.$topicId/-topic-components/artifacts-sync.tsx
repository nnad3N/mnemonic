import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { pendingArtifactsQuery } from "../-artifacts-api/get-pending-artifacts";
import { useChatStore } from "../../-chat-store";
import { useIsUploadingArtifact } from "../../_protected.chat.$threadId/-hooks/use-upload-artifact";
import { threadKeys } from "../../_protected.chat.$threadId/-thread-api/query-keys";

const POLL_MS = 2000;

type ArtifactsSyncProps = {
  topicId: string;
  threadId?: string;
};

export const ArtifactsSync = ({ topicId, threadId }: ArtifactsSyncProps) => {
  const queryClient = useQueryClient();
  const isPolling = useChatStore((state) => state.pollingTopicIds.has(topicId));
  const addPollingTopicId = useChatStore((state) => state.addPollingTopicId);
  const removePollingTopicId = useChatStore(
    (state) => state.removePollingTopicId
  );
  const { data: hasPendingArtifacts } = useSuspenseQuery({
    ...pendingArtifactsQuery(topicId),
    select: (data) => data.length > 0,
    refetchInterval: isPolling ? POLL_MS : false,
  });
  const isUploading = threadId ? useIsUploadingArtifact(threadId) : false;

  useEffect(() => {
    const shouldPoll = hasPendingArtifacts && !isUploading;

    if (shouldPoll) {
      addPollingTopicId(topicId);
    } else {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mentions(topicId),
      });
      void queryClient.invalidateQueries({
        queryKey: topicKeys.artifacts(topicId),
      });
      removePollingTopicId(topicId);
    }

    return () => {
      removePollingTopicId(topicId);
    };
  }, [
    isUploading,
    queryClient,
    hasPendingArtifacts,
    removePollingTopicId,
    addPollingTopicId,
    topicId,
  ]);

  return null;
};
