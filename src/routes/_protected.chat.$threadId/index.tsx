import { createFileRoute } from "@tanstack/react-router";

import { AssistantMessage } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message";
import { UserMessage } from "@/routes/_protected.chat.$threadId/-thread-components/user-message";

import { useChat } from "./-use-chat";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  const chat = useChat();

  return (
    <div>
      {chat.messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      )}
    </div>
  );
}
