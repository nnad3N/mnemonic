import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import {
  noteAccessMiddleware,
  threadAccessMiddleware,
} from "@/lib/middleware/assert-thread-access.middleware";

import {
  createNoteFn,
  deleteNoteFn,
  getNoteFn,
  saveNoteBodyFn,
  saveNoteTitleFn,
  addNoteToTopicFn,
} from "./notes.server";

export const noteQueries = {
  all: () => ["notes"] as const,
  byId: (noteId: string) =>
    queryOptions({
      queryFn: async () => getNote({ data: { noteId } }),
      queryKey: [...noteQueries.all(), "byId", noteId] as const,
    }),
};

const noteCtx = Kit.createContext(dbKit);
const addNoteToTopicCtx = Kit.createContext(dbKit, memoryKit);

const noteInputSchema = v.object({
  noteId: v.pipe(v.string(), v.nanoid()),
});

export const getNote = createServerFn({ method: "GET" })
  .validator(noteInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () => getNoteFn(noteCtx, { noteId: context.note.id })).throws<ServerFnError>(
      (error) =>
        matchError(error, {
          DatabaseError: () => toServerFnError.serverError("Failed to load the note"),
          ServerFnError: (error) => error,
          UnhandledException: () => toServerFnError.serverError("Failed to load the note"),
        }),
    ),
  );

const createNoteInputSchema = v.object({
  threadId: v.pipe(v.string(), v.nanoid()),
  title: v.pipe(v.string(), v.nonEmpty()),
});

export const createNote = createServerFn({ method: "POST" })
  .validator(createNoteInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      createNoteFn(noteCtx, {
        threadId: context.thread.id,
        title: data.title,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to create the note")),
  );

const saveNoteBodyInputSchema = v.object({
  content: v.string(),
  noteId: v.pipe(v.string(), v.nanoid()),
});

export const saveNoteBody = createServerFn({ method: "POST" })
  .validator(saveNoteBodyInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      saveNoteBodyFn(noteCtx, { content: data.content, noteId: context.note.id }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to save the note")),
  );

const saveNoteTitleInputSchema = v.object({
  noteId: v.pipe(v.string(), v.nanoid()),
  title: v.pipe(v.string(), v.nonEmpty()),
});

export const saveNoteTitle = createServerFn({ method: "POST" })
  .validator(saveNoteTitleInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      saveNoteTitleFn(noteCtx, { noteId: context.note.id, title: data.title }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to rename the note")),
  );

export const addNoteToTopic = createServerFn({ method: "POST" })
  .validator(noteInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      addNoteToTopicFn(addNoteToTopicCtx, {
        noteId: context.note.id,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to add the note to the topic"),
        MemoryError: () => toServerFnError.serverError("Failed to add the note to the topic"),
        ServerFnError: (error) => error,
        ThreadNotFoundError: () => toServerFnError.notFound(),
      }),
    ),
  );

export const deleteNote = createServerFn({ method: "POST" })
  .validator(noteInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () => deleteNoteFn(noteCtx, { noteId: context.note.id })).throws<ServerFnError>(
      () => toServerFnError.serverError("Failed to delete the note"),
    ),
  );
