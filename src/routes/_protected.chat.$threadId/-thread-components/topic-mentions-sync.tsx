import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useIsUploadingArtifact } from "../-hooks/use-upload-artifact";
import { mentionsQuery } from "../-thread-api/get-mentions";
import { useThreadStore } from "../-thread-store";
import { isMentionPending } from "../-thread-utils";

const POLL_MS = 2000;

type TopicMentionsSyncProps = {
  threadId: string;
  topicId: string;
};

export const TopicMentionsSync = ({
  threadId,
  topicId,
}: TopicMentionsSyncProps) => {
  const pollingTopicId = useThreadStore((state) => state.pollingTopicId);
  const setPollingTopicId = useThreadStore((state) => state.setPollingTopicId);
  const { data: mentions } = useSuspenseQuery({
    ...mentionsQuery(topicId),
    refetchInterval: pollingTopicId === topicId ? POLL_MS : false,
  });
  const isUploading = useIsUploadingArtifact(threadId);

  useEffect(() => {
    const hasPendingMentions = mentions.some((mention) =>
      isMentionPending(mention)
    );

    if (hasPendingMentions && !isUploading) {
      setPollingTopicId(topicId);
    } else {
      setPollingTopicId(null);
    }

    return () => {
      if (useThreadStore.getState().pollingTopicId === topicId) {
        setPollingTopicId(null);
      }
    };
  }, [isUploading, mentions, setPollingTopicId, topicId]);

  return null;
};
