import type { ChatStatus, UIMessage } from "ai";

import { m } from "@/paraglide/messages";

import { useThreadChat } from "../-hooks/use-thread-chat";
import { ThreadMetaLine } from "./thread-meta-line";

const shouldShowThreadPending = (
  status: ChatStatus,
  messages: UIMessage[]
): boolean => {
  if (status === "submitted") {
    return true;
  }

  if (status !== "streaming") {
    return false;
  }

  const last = messages.at(-1);

  if (last?.role !== "assistant") {
    return false;
  }

  return (
    last.parts.filter((part) => part.type !== "data-om-status").length === 0
  );
};

export const ThreadPending = () => {
  const chat = useThreadChat();

  if (!shouldShowThreadPending(chat.status, chat.messages)) {
    return null;
  }

  return (
    <ThreadMetaLine>{m.chat_thread_pending_planning()}</ThreadMetaLine>
  );
};
