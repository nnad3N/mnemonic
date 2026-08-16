import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit";
import { duration } from "@/lib/durations";
import { ServerFnError, toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { adminMiddleware } from "@/lib/middleware/admin.middleware";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { toSafeId } from "@/lib/safe-id";
import {
  activateByokFn,
  createByokFn,
  deleteByokFn,
  listByokFn,
  reencryptByokFn,
  renameByokFn,
} from "@/routes/_protected.settings/-byok.server";

export const byokQueries = {
  all: () => ["byok"] as const,
  mine: () =>
    queryOptions({
      queryFn: async () => listMyByok(),
      queryKey: [...byokQueries.all(), "mine"] as const,
      staleTime: duration.FIVE.MINUTES,
    }),
  user: (userId: string) =>
    queryOptions({
      queryFn: async () => listUserByok({ data: { userId } }),
      queryKey: [...byokQueries.all(), "user", userId] as const,
      staleTime: duration.FIVE.MINUTES,
    }),
};

const byokCtx = Kit.createContext(dbKit);

export type ByokItem = {
  active: boolean;
  createdAt: Date;
  id: string;
  keyPreview: string;
  name: string;
};

const listMyByok = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () => listByokFn(byokCtx, context.user.id)).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load your API keys"),
      }),
    ),
  );

const listUserByok = createServerFn({ method: "GET" })
  .validator(v.object({ userId: v.pipe(v.string(), v.nanoid()) }))
  .middleware([adminMiddleware])
  .handler(async ({ data }) =>
    Kit.run(async () =>
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped lookup.
      listByokFn(byokCtx, toSafeId<"user">(data.userId)),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load API keys for this user"),
      }),
    ),
  );

export const createMyByok = createServerFn({ method: "POST" })
  .validator(
    v.object({
      key: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      createByokFn(byokCtx, {
        key: data.key,
        name: data.name,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to save the API key"),
        EncryptionError: () => toServerFnError.serverError("Failed to encrypt the API key"),
      }),
    ),
  );

export const renameMyByok = createServerFn({ method: "POST" })
  .validator(
    v.object({
      id: v.pipe(v.string(), v.nanoid()),
      name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      renameByokFn(byokCtx, {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"byok">(data.id),
        name: data.name,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to rename the API key"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const deleteMyByok = createServerFn({ method: "POST" })
  .validator(v.object({ id: v.pipe(v.string(), v.nanoid()) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      deleteByokFn(byokCtx, {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"byok">(data.id),
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to delete the API key"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const activateMyByok = createServerFn({ method: "POST" })
  .validator(v.object({ id: v.pipe(v.string(), v.nanoid()) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      activateByokFn(byokCtx, {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"byok">(data.id),
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to activate the API key"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const createUserByok = createServerFn({ method: "POST" })
  .validator(
    v.object({
      key: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      userId: v.pipe(v.string(), v.nanoid()),
    }),
  )
  .middleware([adminMiddleware])
  .handler(async ({ data }) =>
    Kit.run(async () =>
      createByokFn(byokCtx, {
        key: data.key,
        name: data.name,
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped write.
        userId: toSafeId<"user">(data.userId),
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to save the API key"),
        EncryptionError: () => toServerFnError.serverError("Failed to encrypt the API key"),
      }),
    ),
  );

export const renameUserByok = createServerFn({ method: "POST" })
  .validator(
    v.object({
      id: v.pipe(v.string(), v.nanoid()),
      name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      userId: v.pipe(v.string(), v.nanoid()),
    }),
  )
  .middleware([adminMiddleware])
  .handler(async ({ data }) =>
    Kit.run(async () =>
      renameByokFn(byokCtx, {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped rename.
        id: toSafeId<"byok">(data.id),
        name: data.name,
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped rename.
        userId: toSafeId<"user">(data.userId),
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to rename the API key"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const deleteUserByok = createServerFn({ method: "POST" })
  .validator(
    v.object({
      id: v.pipe(v.string(), v.nanoid()),
      userId: v.pipe(v.string(), v.nanoid()),
    }),
  )
  .middleware([adminMiddleware])
  .handler(async ({ data }) =>
    Kit.run(async () =>
      deleteByokFn(byokCtx, {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped delete.
        id: toSafeId<"byok">(data.id),
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped delete.
        userId: toSafeId<"user">(data.userId),
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to delete the API key"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const activateUserByok = createServerFn({ method: "POST" })
  .validator(
    v.object({
      id: v.pipe(v.string(), v.nanoid()),
      userId: v.pipe(v.string(), v.nanoid()),
    }),
  )
  .middleware([adminMiddleware])
  .handler(async ({ data }) =>
    Kit.run(async () =>
      activateByokFn(byokCtx, {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped activate.
        id: toSafeId<"byok">(data.id),
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- admin-scoped activate.
        userId: toSafeId<"user">(data.userId),
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to activate the API key"),
        ServerFnError: (error) => error,
      }),
    ),
  );

export const reencryptByok = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .handler(async () =>
    Kit.run(async () => reencryptByokFn(byokCtx)).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to re-encrypt API keys"),
        EncryptionError: () =>
          toServerFnError.serverError(
            "A stored API key could not be read with the current keyring",
          ),
      }),
    ),
  );
