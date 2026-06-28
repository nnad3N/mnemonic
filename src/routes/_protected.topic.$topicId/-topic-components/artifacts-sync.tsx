import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { getPendingArtifacts } from "../-artifacts-api/get-pending-artifacts";
import { useChatStore } from "../../-chat-store";
import { threadKeys } from "../../_protected.chat.$threadId/-thread-api/query-keys";

const POLL_MS = 2000;

type ArtifactsSyncProps = {
  topicId: string;
};

export const ArtifactsSync = ({ topicId }: ArtifactsSyncProps) => {
  const queryClient = useQueryClient();
  const isPolling = useChatStore((state) => state.pollingTopicIds.has(topicId));
  const addPollingTopicId = useChatStore((state) => state.addPollingTopicId);
  const removePollingTopicId = useChatStore(
    (state) => state.removePollingTopicId
  );
  const { data: pendingArtifacts } = useSuspenseQuery({
    queryFn: async () =>
      getPendingArtifacts({
        data: { topicId },
      }),
    queryKey: [...topicKeys.artifacts(topicId), "pending"] as const,
    refetchInterval: isPolling ? POLL_MS : false,
  });

  useEffect(() => {
    if (pendingArtifacts.length > 0) {
      addPollingTopicId(topicId);
      return;
    }

    for (const artifact of pendingArtifacts) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mention(artifact.id),
      });
    }

    void queryClient.invalidateQueries({
      queryKey: threadKeys.mentions(topicId),
    });

    void queryClient.invalidateQueries({
      queryKey: topicKeys.artifacts(topicId),
    });

    removePollingTopicId(topicId);

    return () => {
      removePollingTopicId(topicId);
    };
  }, [
    queryClient,
    removePollingTopicId,
    addPollingTopicId,
    topicId,
    pendingArtifacts,
  ]);

  return null;
};
