import { handleChatStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/request-context";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import * as v from "valibot";

import { db } from "@/db";
import { applyMessageEdit } from "@/lib/chat/apply-message-edit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { mastra } from "@/mastra";
import { mnemonicAgentId } from "@/mastra/agents/mnemonic-agent";
import { getAgentMemory, getMemoryStore } from "@/mastra/memory";
import type { MnemonicRequestContext } from "@/mastra/request-context";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

const uiMessageSchema = v.object({
  id: v.pipe(v.string(), v.nanoid()),
  role: v.picklist(["system", "user", "assistant"]),
  parts: v.array(v.looseObject({})),
  metadata: v.optional(v.unknown()),
});

const chatRequestSchema = v.pipe(
  v.object({
    threadId: v.pipe(v.string(), v.nanoid()),
    messages: v.array(uiMessageSchema),
    trigger: v.optional(v.picklist(["submit-message", "regenerate-message"])),
    runId: v.optional(v.pipe(v.string(), v.nanoid())),
    resumeData: v.optional(v.record(v.string(), v.unknown())),
    id: v.optional(v.pipe(v.string(), v.nanoid())),
    messageId: v.optional(v.pipe(v.string(), v.nanoid())),
    metadata: v.optional(v.unknown()),
    resourceId: v.optional(v.pipe(v.string(), v.nanoid())),
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

        const topic = await db.query.topic.findFirst({
          where: {
            id: thread.resourceId,
            userId: context.user.id,
          },
          columns: { id: true },
        });

        if (thread.resourceId !== context.user.id && !topic) {
          return new Response("Not Found", { status: 404 });
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

        const requestContext = new RequestContext<MnemonicRequestContext>();
        requestContext.set("userId", context.user.id);

        if (topic) {
          requestContext.set("filter", { topicId: topic.id });
        }

        const stream = await handleChatStream<ThreadUIMessage>({
          agentId: mnemonicAgentId,
          defaultOptions: {
            delegation: {
              includeSubAgentToolResultsInModelContext: true,
            },
            maxSteps: 10,
          },
          mastra,
          params: {
            ...body,
            abortSignal: request.signal,
            memory: {
              resource: thread.resourceId,
              thread: body.threadId,
            },
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            messages: body.messages as ThreadUIMessage[],
            requestContext,
          },
          sendReasoning: true,
          sendSources: true,
          version: "v6",
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
