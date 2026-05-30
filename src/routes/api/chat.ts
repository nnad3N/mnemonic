import { handleChatStream } from "@mastra/ai-sdk";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { topic } from "@/db/schema";
import { applyMessageEdit } from "@/lib/chat/apply-message-edit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { mastra } from "@/mastra";
import { mnemonicAgentId } from "@/mastra/agents/mnemonic-agent";
import { getAgentMemory, getMemoryStore } from "@/mastra/memory";

const uiMessageSchema = v.object({
  id: v.string(),
  role: v.picklist(["system", "user", "assistant"]),
  parts: v.array(v.looseObject({})),
  metadata: v.optional(v.unknown()),
});

const chatRequestSchema = v.pipe(
  v.object({
    threadId: v.pipe(v.string(), v.nonEmpty()),
    messages: v.array(uiMessageSchema),
    trigger: v.optional(v.picklist(["submit-message", "regenerate-message"])),
    runId: v.optional(v.string()),
    resumeData: v.optional(v.record(v.string(), v.unknown())),
    id: v.optional(v.string()),
    messageId: v.optional(v.string()),
    metadata: v.optional(v.unknown()),
    resourceId: v.optional(v.string()),
  }),
  v.forward(
    v.check(
      (input) =>
        input.resumeData === undefined ||
        (input.runId !== undefined && input.runId.length > 0)
    ),
    ["runId"]
  )
);

export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const result = v.safeParse(chatRequestSchema, await request.json());

        if (!result.success) {
          return new Response("Bad Request", { status: 400 });
        }

        const body = result.output;

        const memoryStore = await getMemoryStore();
        const thread = await memoryStore.getThreadById({
          threadId: body.threadId,
        });

        if (thread === null) {
          return new Response("Not Found", { status: 404 });
        }

        if (thread.resourceId !== context.user.id) {
          const ownedTopic = await db.query.topic.findFirst({
            where: {
              id: thread.resourceId,
              userId: context.user.id,
            },
            columns: { id: true },
          });

          if (!ownedTopic) {
            return new Response("Not Found", { status: 404 });
          }

          await db
            .update(topic)
            .set({ updatedAt: new Date() })
            .where(eq(topic.id, thread.resourceId));
        }

        if (body.messageId) {
          const memory = await getAgentMemory();

          await applyMessageEdit({
            memory,
            memoryStore,
            threadId: body.threadId,
            messageId: body.messageId,
          });
        }

        const stream = await handleChatStream<UIMessage>({
          mastra,
          agentId: mnemonicAgentId,
          params: {
            ...body,
            abortSignal: request.signal,
            memory: {
              resource: thread.resourceId,
              thread: body.threadId,
            },
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            messages: body.messages as UIMessage[],
          },
          version: "v6",
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
