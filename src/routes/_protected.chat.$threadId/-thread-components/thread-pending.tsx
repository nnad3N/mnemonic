import type { ChatStatus, UIMessage } from "ai";

import { m } from "@/paraglide/messages";

import { useThreadChat } from "../-hooks/use-thread-chat";

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
    <p className="w-full shimmer px-2.5 text-base text-muted-foreground md:text-sm">
      {m.chat_thread_pending_planning()}
    </p>
  );
};
