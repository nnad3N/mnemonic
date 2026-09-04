import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { topic } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { ServerFnError, toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access.middleware";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { providerKeyMiddleware } from "@/lib/middleware/provider-key.middleware";
import { getResourceId } from "@/lib/middleware/resolve-thread.server";
import { s3Kit } from "@/lib/s3-kit.server";
import { vectorKit } from "@/lib/vector-kit.server";

import {
  createThreadTitleFn,
  createTopicFn,
  deleteConversationFn,
  deleteTopicFn,
  getThreadFn,
} from "./thread.server";

const createThreadTitleSchema = v.object({
  text: v.pipe(v.string(), v.nonEmpty()),
});

const createTopicCtx = Kit.createContext(dbKit, memoryKit);

export const createConversation = createServerFn({ method: "POST" })
  .validator(
    v.object({
      id: v.optional(v.pipe(v.string(), v.nanoid())),
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const now = new Date();
    const result = await Kit.get(memoryKit).saveThread({
      thread: {
        id: data.id ?? nanoid(),
        resourceId: getResourceId({ topicId: undefined, userId: context.user.id }),
        title: data.title,
        createdAt: now,
        updatedAt: now,
      },
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to create conversation");
    }

    return {
      id: result.value.id,
    };
  });

export const createTopic = createServerFn({ method: "POST" })
  .validator(
    v.object({
      conversationTitle: v.pipe(v.string(), v.nonEmpty()),
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      createTopicFn(createTopicCtx, {
        conversationTitle: data.conversationTitle,
        title: data.title,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to create topic"),
        MemoryError: () => toServerFnError.serverError("Failed to create topic conversation"),
      }),
    ),
  );

export const createTopicThread = createServerFn({ method: "POST" })
  .validator(
    v.object({
      id: v.optional(v.pipe(v.string(), v.nanoid())),
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const now = new Date();
    const result = await Kit.get(memoryKit).saveThread({
      thread: {
        id: data.id ?? nanoid(),
        resourceId: getResourceId({ topicId: context.topic.id, userId: context.user.id }),
        title: data.title,
        createdAt: now,
        updatedAt: now,
      },
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to create topic conversation");
    }

    return { id: result.value.id };
  });

const deleteConversationCtx = Kit.createContext(dbKit, memoryKit);

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      deleteConversationFn(deleteConversationCtx, {
        threadId: context.thread.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to delete conversation"),
        MemoryError: () => toServerFnError.serverError("Failed to delete conversation"),
      }),
    ),
  );

const deleteThreadCtx = Kit.createContext(dbKit, s3Kit, memoryKit, vectorKit);

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      deleteTopicFn(deleteThreadCtx, {
        topicId: context.topic.id,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to delete topic")),
  );

export const renameConversation = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(memoryKit).updateThread({
      id: context.thread.id,
      metadata: context.thread.metadata ?? {},
      title: data.title,
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to rename conversation");
    }

    return { id: context.thread.id };
  });

export const renameTopic = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db.update(topic).set({ title: data.title }).where(eq(topic.id, context.topic.id)),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to rename topic");
    }

    return { id: context.topic.id };
  });

const getThreadCtx = Kit.createContext(dbKit, memoryKit);

export const getThread = createServerFn({ method: "GET" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      getThreadFn(getThreadCtx, {
        threadId: context.thread.id,
        topicId: context.topicId,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load thread topic"),
        MemoryError: () => toServerFnError.serverError("Failed to load thread messages"),
      }),
    ),
  );

const createThreadTitleCtx = Kit.createContext(memoryKit);

export const createThreadTitle = createServerFn({ method: "POST" })
  .validator(createThreadTitleSchema)
  .middleware([threadAccessMiddleware, providerKeyMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      createThreadTitleFn(createThreadTitleCtx, {
        providerKey: context.providerKey,
        metadata: context.thread.metadata ?? {},
        text: data.text,
        threadId: context.thread.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        MemoryError: () => toServerFnError.serverError("Failed to save conversation title"),
        ServerFnError: (error) => error,
      }),
    ),
  );
