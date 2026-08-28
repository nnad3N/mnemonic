import { keepPreviousData, queryOptions } from "@tanstack/react-query";
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
import { authMiddleware } from "@/lib/middleware/auth.middleware";

import {
  createNoteFn,
  deleteNoteFn,
  getNoteFn,
  listNotesFn,
  saveNoteBodyFn,
  saveNoteTitleFn,
  addNoteToTopicFn,
} from "./notes.server";

export const noteQueries = {
  all: () => ["notes"] as const,
  list: ({ page, pageSize, scope, search }: ListNotesParams) =>
    queryOptions({
      placeholderData: keepPreviousData,
      queryFn: async () => listNotes({ data: { page, pageSize, scope, search } }),
      queryKey: [...noteQueries.byScope(scope), { page, pageSize, search }] as const,
    }),
  scopeBase: () => [...noteQueries.all(), "scope"] as const,
  byScope: (scope: ListNotesParams["scope"]) =>
    [...noteQueries.scopeBase(), scope.type, scope.id] as const,
  byId: (noteId: string) =>
    queryOptions({
      queryFn: async () => getNote({ data: { noteId } }),
      queryKey: [...noteQueries.all(), "byId", noteId] as const,
    }),
};

const noteCtx = Kit.createContext(dbKit, memoryKit);

const noteInputSchema = v.object({
  noteId: v.pipe(v.string(), v.nanoid()),
});

const listNotesInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(1)),
  pageSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  scope: v.variant("type", [
    v.object({ id: v.pipe(v.string(), v.nanoid()), type: v.literal("thread") }),
    v.object({ id: v.pipe(v.string(), v.nanoid()), type: v.literal("topic") }),
  ]),
  search: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.transform((value) => (value.length > 0 ? value : undefined)),
    ),
  ),
});

export type ListNotesParams = v.InferOutput<typeof listNotesInputSchema>;

export const listNotes = createServerFn({ method: "GET" })
  .validator(listNotesInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      listNotesFn(noteCtx, {
        page: data.page,
        pageSize: data.pageSize,
        scope: data.scope,
        search: data.search,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to list notes"),
        MemoryError: () => toServerFnError.serverError("Failed to list notes"),
      }),
    ),
  );

export const getNote = createServerFn({ method: "GET" })
  .validator(noteInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      getNoteFn(noteCtx, { noteId: context.note.id, userId: context.user.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load the note"),
        MemoryError: () => toServerFnError.serverError("Failed to load the note"),
        ServerFnError: (error) => error,
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
        author: "user",
        content: "",
        threadId: context.thread.id,
        title: data.title,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to create the note")),
  );

const saveNoteBodyInputSchema = v.object({
  baseVersionId: v.pipe(v.string(), v.nanoid()),
  content: v.string(),
  noteId: v.pipe(v.string(), v.nanoid()),
});

export const saveNoteBody = createServerFn({ method: "POST" })
  .validator(saveNoteBodyInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      saveNoteBodyFn(noteCtx, {
        baseVersionId: data.baseVersionId,
        content: data.content,
        noteId: context.note.id,
      }),
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
      addNoteToTopicFn(noteCtx, {
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
