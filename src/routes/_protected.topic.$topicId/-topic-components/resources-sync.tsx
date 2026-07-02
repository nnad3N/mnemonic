import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

import { getPendingResources } from "../-resources-api/get-pending-resources";
import { useChatStore } from "../../-chat-store";
import { threadKeys } from "../../_protected.chat.$threadId/-thread-api/query-keys";

const POLL_MS = 2000;

type ResourcesSyncProps = {
  topicId: string;
};

export const ResourcesSync = ({ topicId }: ResourcesSyncProps) => {
  const queryClient = useQueryClient();
  const previousPendingResourceIds = useRef<string[]>([]);
  const isPolling = useChatStore((state) => state.pollingTopicIds.has(topicId));
  const { data: pendingResources } = useSuspenseQuery({
    queryFn: async () =>
      getPendingResources({
        data: { topicId },
      }),
    select: (data) => data.map((resource) => resource.id),
    queryKey: [topicId, "pending-resources"] as const,
    refetchInterval: isPolling ? POLL_MS : false,
  });

  useEffect(() => {
    const { removePollingTopicId, addPollingTopicId } = useChatStore.getState();
    const removedResourceIds = previousPendingResourceIds.current.filter(
      (resourceId) => !pendingResources.includes(resourceId)
    );

    previousPendingResourceIds.current = pendingResources;

    if (pendingResources.length > 0) {
      addPollingTopicId(topicId);
    } else {
      removePollingTopicId(topicId);
    }

    for (const resourceId of removedResourceIds) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mention("resource", resourceId),
      });
    }

    if (removedResourceIds.length > 0) {
      void queryClient.invalidateQueries({
        queryKey: threadKeys.mentions(topicId),
      });

      void queryClient.invalidateQueries({
        queryKey: topicKeys.resources(topicId),
      });
    }
  }, [queryClient, topicId, pendingResources]);

  useEffect(() => {
    return () => {
      previousPendingResourceIds.current = [];
      useChatStore.getState().removePollingTopicId(topicId);
    };
  }, [topicId]);

  return null;
};
