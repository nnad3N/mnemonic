import type { MastraMemory } from "@mastra/core/memory";
import type { MemoryStorage } from "@mastra/core/storage";

type ApplyMessageEditParams = {
  memory: MastraMemory;
  memoryStore: MemoryStorage;
  threadId: string;
  messageId: string;
};

export const applyMessageEdit = async ({
  memory,
  memoryStore,
  threadId,
  messageId,
}: ApplyMessageEditParams): Promise<void> => {
  const { messages: storedMessages } = await memoryStore.listMessages({
    threadId,
    page: 0,
    perPage: false,
  });

  const messageIndex = storedMessages.findIndex(
    (message) => message.id === messageId
  );

  if (messageIndex === -1) {
    return;
  }

  if (storedMessages[messageIndex].role !== "user") {
    return;
  }

  const messageIdsToDelete = storedMessages
    .slice(messageIndex)
    .map((message) => message.id);

  if (messageIdsToDelete.length > 0) {
    await memory.deleteMessages(messageIdsToDelete);
  }
};
