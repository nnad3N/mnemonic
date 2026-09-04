import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { authMiddleware } from "@/lib/middleware/auth.middleware";

import { getMentionByIdFn, getMentionsFn } from "./mentions.server";
import type { MentionQueryType } from "./mentions.server";

export type MentionsQueryParams = {
  threadId: string;
  query?: string;
};

type GetMentionByIdParams = {
  id: string;
  type: MentionQueryType;
};

export const mentionQueries = {
  all: () => ["mention"] as const,
  listBase: () => [...mentionQueries.all(), "list"] as const,
  byThread: (threadId: string) => [...mentionQueries.listBase(), threadId] as const,
  list: ({ threadId, query }: MentionsQueryParams) =>
    queryOptions({
      queryKey: [...mentionQueries.byThread(threadId), { query }] as const,
      queryFn: async () =>
        getMentions({
          data: { query, threadId },
        }),
      placeholderData: keepPreviousData,
    }),
  byId: ({ id, type }: GetMentionByIdParams) =>
    queryOptions({
      // without this the optimistic update for file upload might be discarded
      refetchOnMount: false,
      queryFn: async () =>
        getMentionById({
          data: { id, type },
        }),
      queryKey: [...mentionQueries.all(), "detail", type, id] as const,
    }),
};

const getMentionsInputSchema = v.object({
  threadId: v.pipe(v.string(), v.nanoid()),
  query: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.transform((value) => (value.length > 0 ? value : undefined)),
    ),
  ),
});

const getMentionByIdInputSchema = v.object({
  id: v.pipe(v.string(), v.nanoid()),
  type: v.picklist(["file", "note", "thread", "topic"]),
});

const mentionsCtx = Kit.createContext(dbKit, memoryKit);

export const getMentions = createServerFn({ method: "GET" })
  .validator(getMentionsInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getMentionsFn(mentionsCtx, {
        query: data.query,
        threadId: data.threadId,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load mentions"),
        MemoryError: () => toServerFnError.serverError("Failed to load conversation mentions"),
        ThreadNotFoundError: () => toServerFnError.notFound(),
      }),
    ),
  );

export const getMentionById = createServerFn({ method: "GET" })
  .validator(getMentionByIdInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getMentionByIdFn(mentionsCtx, {
        id: data.id,
        type: data.type,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load mention"),
        MemoryError: () => toServerFnError.serverError("Failed to load conversation mention"),
        ServerFnError: (error) => error,
        ThreadNotFoundError: () => toServerFnError.notFound(),
      }),
    ),
  );
