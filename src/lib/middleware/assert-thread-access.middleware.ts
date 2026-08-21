import { createMiddleware } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import { toSafeId } from "@/lib/safe-id";

const threadAccessInputSchema = v.looseObject({
  threadId: v.pipe(v.string(), v.nanoid()),
});

type ThreadAccessInputSchema = v.InferOutput<typeof threadAccessInputSchema>;

// Return `unknown` from access middleware validators intentionally: the typed
// parameter keeps the ID required at call sites, but prevents middleware input
// from being merged into handler `data`. Later server-fn `v.object(...)`
// validators strip unknown keys at runtime, so handlers should read these IDs
// from context instead.
const threadAccessCtx = Kit.createContext(dbKit, memoryKit);

export const threadAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion
  .validator((data: ThreadAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { threadId } = v.parse(threadAccessInputSchema, data);
    const result = await resolveThread(threadAccessCtx, { threadId, userId: context.user.id });

    if (Result.isError(result)) {
      throw matchError(result.error, {
        DatabaseError: () => toServerFnError.serverError("Failed to verify thread access"),
        MemoryError: () => toServerFnError.serverError("Failed to verify thread access"),
        ThreadNotFoundError: () => toServerFnError.notFound(),
      });
    }

    return next({
      context: {
        thread: result.value.thread,
        topicId: result.value.topicId,
      },
    });
  });

const topicAccessInputSchema = v.looseObject({
  topicId: v.pipe(v.string(), v.nanoid()),
});

type TopicAccessInputSchema = v.InferOutput<typeof topicAccessInputSchema>;

export const topicAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion
  .validator((data: TopicAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { topicId } = v.parse(topicAccessInputSchema, data);
    const topicResult = await Kit.get(dbKit).run((db) =>
      db.query.topic.findFirst({
        where: {
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
          id: toSafeId<"topic">(topicId),
          userId: context.user.id,
        },
        columns: { id: true },
      }),
    );

    if (Result.isError(topicResult)) {
      throw toServerFnError.serverError("Failed to verify topic access");
    }

    const ownedTopic = topicResult.value;

    if (!ownedTopic) {
      throw toServerFnError.notFound();
    }

    return next({
      context: {
        topic: ownedTopic,
      },
    });
  });

const fileAccessInputSchema = v.looseObject({
  fileId: v.pipe(v.string(), v.nanoid()),
});

type FileAccessInputSchema = v.InferOutput<typeof fileAccessInputSchema>;

export const fileAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion
  .validator((data: FileAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { fileId } = v.parse(fileAccessInputSchema, data);
    const fileResult = await Kit.get(dbKit).run((db) =>
      db.query.file.findFirst({
        columns: {
          displayName: true,
          id: true,
          s3Key: true,
          status: true,
          topicId: true,
        },
        where: {
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
          id: toSafeId<"file">(fileId),
          userId: context.user.id,
        },
      }),
    );

    if (Result.isError(fileResult)) {
      throw toServerFnError.serverError("Failed to verify file access");
    }

    const ownedFile = fileResult.value;

    if (!ownedFile) {
      throw toServerFnError.notFound();
    }

    return next({
      context: {
        file: ownedFile,
        topicId: ownedFile.topicId,
      },
    });
  });

const noteAccessInputSchema = v.looseObject({
  noteId: v.pipe(v.string(), v.nanoid()),
});

type NoteAccessInputSchema = v.InferOutput<typeof noteAccessInputSchema>;

export const noteAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .validator((data: NoteAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { noteId } = v.parse(noteAccessInputSchema, data);
    const noteResult = await Kit.get(dbKit).run((db) =>
      db.query.note.findFirst({
        columns: { id: true, topicId: true },
        where: {
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
          id: toSafeId<"note">(noteId),
          userId: context.user.id,
        },
      }),
    );

    if (Result.isError(noteResult)) {
      throw toServerFnError.serverError("Failed to verify note access");
    }

    const ownedNote = noteResult.value;

    if (!ownedNote) {
      throw toServerFnError.notFound();
    }

    return next({
      context: {
        note: ownedNote,
      },
    });
  });
