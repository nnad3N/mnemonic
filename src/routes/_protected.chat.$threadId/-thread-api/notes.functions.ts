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
  declineAgentVersionsFn,
  deleteNoteFn,
  getNoteFn,
  getNoteVersionFn,
  listNoteVersionsFn,
  listNotesFn,
  resetNoteToVersionFn,
  saveAgentVersionFn,
  saveNoteBodyFn,
  saveNoteTitleFn,
  addNoteToTopicFn,
  listAffectedNotesFn,
} from "./notes.server";

export const noteQueries = {
  all: () => ["notes"] as const,
  list: ({ page, pageSize, scope, search }: ListNotesParams) =>
    queryOptions({
      placeholderData: keepPreviousData,
      queryFn: async () => listNotes({ data: { page, pageSize, scope, search } }),
      queryKey: [...noteQueries.byScope(scope), { page, pageSize, search }] as const,
    }),
  lists: () => [...noteQueries.all(), "list"] as const,
  byScope: (scope: ListNotesParams["scope"]) =>
    [...noteQueries.lists(), scope.type, scope.id] as const,
  details: () => [...noteQueries.all(), "detail"] as const,
  byId: (noteId: string) =>
    queryOptions({
      queryFn: async () => getNote({ data: { noteId } }),
      queryKey: [...noteQueries.details(), noteId] as const,
    }),
  versionDetails: (noteId: string) => [...noteQueries.byId(noteId).queryKey, "version"] as const,
  version: (noteId: string, versionId: string) =>
    queryOptions({
      queryFn: async () => getNoteVersion({ data: { noteId, versionId } }),
      queryKey: [...noteQueries.versionDetails(noteId), versionId] as const,
      staleTime: Infinity,
    }),
  versionLists: (noteId: string) => [...noteQueries.byId(noteId).queryKey, "versions"] as const,
  versions: (noteId: string) =>
    queryOptions({
      queryFn: async () => listNoteVersions({ data: { noteId } }),
      queryKey: [...noteQueries.versionLists(noteId), "list"] as const,
    }),
  affectedAll: () => [...noteQueries.all(), "affected"] as const,
  affected: (versionIds: string[]) =>
    queryOptions({
      queryFn: async () => listAffectedNotes({ data: { versionIds } }),
      queryKey: [...noteQueries.affectedAll(), { versionIds }] as const,
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

export type NoteDetail = Awaited<ReturnType<typeof getNote>>;

const listAffectedNotesInputSchema = v.object({
  versionIds: v.pipe(v.array(v.pipe(v.string(), v.nanoid())), v.maxLength(50)),
});

export const listAffectedNotes = createServerFn({ method: "GET" })
  .validator(listAffectedNotesInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      listAffectedNotesFn(noteCtx, { userId: context.user.id, versionIds: data.versionIds }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load the affected notes"),
      }),
    ),
  );

export type AffectedNoteStats = Awaited<ReturnType<typeof listAffectedNotes>>[number];

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

const noteVersionInputSchema = v.object({
  noteId: v.pipe(v.string(), v.nanoid()),
  versionId: v.pipe(v.string(), v.nanoid()),
});

export const getNoteVersion = createServerFn({ method: "GET" })
  .validator(noteVersionInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getNoteVersionFn(noteCtx, { noteId: context.note.id, versionId: data.versionId }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load the note version"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const resetNoteToVersion = createServerFn({ method: "POST" })
  .validator(noteVersionInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      resetNoteToVersionFn(noteCtx, { noteId: context.note.id, versionId: data.versionId }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to reset the note"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const listNoteVersions = createServerFn({ method: "GET" })
  .validator(noteInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      listNoteVersionsFn(noteCtx, { noteId: context.note.id }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to load the note history")),
  );

const saveAgentVersionInputSchema = v.object({
  commit: v.optional(v.boolean(), false),
  content: v.string(),
  noteId: v.pipe(v.string(), v.nanoid()),
  versionId: v.pipe(v.string(), v.nanoid()),
  versionUpdatedAt: v.pipe(v.number(), v.integer()),
});

export const STALE_NOTE_VERSION_STATUS = "stale-note-version";

export const saveAgentVersion = createServerFn({ method: "POST" })
  .validator(saveAgentVersionInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      saveAgentVersionFn(noteCtx, {
        commit: data.commit,
        content: data.content,
        noteId: context.note.id,
        versionId: data.versionId,
        versionUpdatedAt: data.versionUpdatedAt,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to save the note"),
        StaleNoteVersionError: () =>
          toServerFnError.custom(
            STALE_NOTE_VERSION_STATUS,
            "The note version moved past this edit",
          ),
      }),
    ),
  );

export const declineAgentVersions = createServerFn({ method: "POST" })
  .validator(noteInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      declineAgentVersionsFn(noteCtx, { noteId: context.note.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to decline the note changes"),
        StaleNoteVersionError: () =>
          toServerFnError.custom(STALE_NOTE_VERSION_STATUS, "The note moved past this review"),
      }),
    ),
  );

const saveNoteBodyInputSchema = v.variant("intent", [
  v.object({
    content: v.string(),
    intent: v.literal("append"),
    noteId: v.pipe(v.string(), v.nanoid()),
  }),
  v.object({
    baseVersionId: v.pipe(v.string(), v.nanoid()),
    content: v.string(),
    intent: v.literal("overwrite"),
    noteId: v.pipe(v.string(), v.nanoid()),
  }),
]);

export const saveNoteBody = createServerFn({ method: "POST" })
  .validator(saveNoteBodyInputSchema)
  .middleware([noteAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      saveNoteBodyFn(noteCtx, { ...data, noteId: context.note.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to save the note"),
        StaleNoteVersionError: () =>
          toServerFnError.custom(STALE_NOTE_VERSION_STATUS, "The note moved past this edit"),
      }),
    ),
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
