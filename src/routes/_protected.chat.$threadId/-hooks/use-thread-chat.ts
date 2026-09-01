import { Chat, useChat } from "@ai-sdk/react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { PrepareSendMessagesRequest, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

import { setNoteSearchOpen } from "@/components/notes-editor/use-open-note";
import { getClientRouter } from "@/router";

import { noteQueries } from "../-thread-api/notes.functions";
import { threadSettingsQueries } from "../-thread-api/thread-settings.functions";
import { getThread } from "../-thread-api/thread.functions";
import type { ThreadUIMessage } from "../-thread-types";
import { useChatStore } from "../../-chat-store";

const Route = getRouteApi("/_protected/chat/$threadId");

type ChatSendTrigger = Parameters<PrepareSendMessagesRequest<UIMessage>>[0]["trigger"];

export const getMessagesToSend = <TMessage extends UIMessage>(
  messages: TMessage[],
  trigger: ChatSendTrigger,
): TMessage[] => {
  const lastMessage = messages.at(-1);

  if (!lastMessage) {
    return [];
  }

  const previousMessage = messages.at(-2);
  const isRegenerateAssistant =
    trigger === "regenerate-message" && lastMessage.role === "assistant";

  if (isRegenerateAssistant && previousMessage) {
    return [previousMessage, lastMessage];
  }

  return [lastMessage];
};

export const threadQueries = {
  all: () => ["thread"] as const,
  chat: (threadId: string) =>
    queryOptions({
      gcTime: Infinity,
      staleTime: Infinity,
      structuralSharing: false,
      queryKey: [...threadQueries.all(), threadId, "chat"] as const,
      queryFn: async ({ client }) => {
        const data = await getThread({
          data: { threadId },
        });

        // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion
        const messages = data.messages as ThreadUIMessage[];

        const chat = new Chat<ThreadUIMessage>({
          id: threadId,
          messages,
          onFinish: ({ messages }) => {
            useChatStore.getState().hydrateAttachments(threadId, messages);
          },
          onData: (dataPart) => {
            if (dataPart.type === "data-note-created") {
              void client.invalidateQueries({ queryKey: noteQueries.lists() });
              void getClientRouter().navigate({
                search: setNoteSearchOpen(dataPart.data.noteId),
                to: ".",
              });
            }

            if (dataPart.type === "data-note-updated") {
              void client.invalidateQueries({
                queryKey: noteQueries.byId(dataPart.data.noteId).queryKey,
              });
              void client.invalidateQueries({ queryKey: noteQueries.affectedAll() });
            }
          },
          onError: (error) => {
            console.error(error);
          },
          transport: new DefaultChatTransport({
            api: "/api/chat",
            prepareSendMessagesRequest: async ({ messages: requestMessages, ...body }) => {
              const settings = await client.ensureQueryData(
                threadSettingsQueries.byThread(threadId),
              );

              return {
                body: {
                  ...body,
                  messages: getMessagesToSend(requestMessages, body.trigger),
                  settings: { modelOption: settings.modelOption },
                  threadId,
                },
              };
            },
          }),
        });

        return {
          chat,
          topicId: data.topicId,
        };
      },
    }),
};

const resumingChats = new WeakSet<Chat<ThreadUIMessage>>();

/**
 * The reconnect route replays the run from its first chunk, so whatever the client holds of
 * the reply — fragments loaded with the thread or a stream it stopped — is rebuilt by the
 * replay and must not be appended to.
 *
 * One attempt per chat at a time: a second call (route remount) would abort the first inside
 * `resumeStream`, whose restore below then puts the reply back while the second call's request
 * snapshots it — the replay then appends to that copy and pushes it as a duplicate message.
 * `chat.status` cannot gate this; it stays `ready` until the reconnect response arrives.
 */
export const resumeThreadStream = async (chat: Chat<ThreadUIMessage>) => {
  if (resumingChats.has(chat)) {
    return;
  }

  resumingChats.add(chat);

  try {
    const hadReply = chat.lastMessage?.role === "assistant";

    if (hadReply) {
      chat.messages = chat.messages.slice(0, -1);
    }

    await chat.resumeStream();

    // Nothing to attach to: the run settled or died in between, and the server has the reply.
    if (hadReply && chat.lastMessage.role !== "assistant") {
      const data = await getThread({ data: { threadId: chat.id } });
      chat.messages = data.messages;
    }
  } finally {
    resumingChats.delete(chat);
  }
};

export const useThreadChat = () => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const { data } = useSuspenseQuery(threadQueries.chat(threadId));

  return useChat({
    chat: data.chat,
    // Dense tool-input-delta bursts (e.g. compute) otherwise nest
    // synchronous replaceMessage → useSyncExternalStore re-renders past React's limit.
    throttle: 32,
  });
};
