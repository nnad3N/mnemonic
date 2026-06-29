import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

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
  const previousPendingArtifactIds = useRef<string[]>([]);
  const isPolling = useChatStore((state) => state.pollingTopicIds.has(topicId));
  const { data: pendingArtifacts } = useSuspenseQuery({
    queryFn: async () =>
      getPendingArtifacts({
        data: { topicId },
      }),
    select: (data) => data.map((artifact) => artifact.id),
    queryKey: [topicId, "pending-artifacts"] as const,
    refetchInterval: isPolling ? POLL_MS : false,
  });

  useEffect(() => {
    const { removePollingTopicId, addPollingTopicId } = useChatStore.getState();
    const removedArtifactIds = previousPendingArtifactIds.current.filter(
      (artifactId) => !pendingArtifacts.includes(artifactId)
    );

    previousPendingArtifactIds.current = pendingArtifacts;

    if (pendingArtifacts.length > 0) {
      addPollingTopicId(topicId);
    } else {
      removePollingTopicId(topicId);
    }

    for (const artifactId of removedArtifactIds) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mention(artifactId),
      });
    }

    if (removedArtifactIds.length > 0) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mentions(topicId),
      });

      void queryClient.invalidateQueries({
        queryKey: topicKeys.artifacts(topicId),
      });
    }
  }, [queryClient, topicId, pendingArtifacts]);

  useEffect(() => {
    return () => {
      previousPendingArtifactIds.current = [];
      useChatStore.getState().removePollingTopicId(topicId);
    };
  }, [topicId]);

  return null;
};
