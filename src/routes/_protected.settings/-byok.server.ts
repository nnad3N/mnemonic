import { Result } from "better-result";
import { and, eq, isNotNull } from "drizzle-orm";

import { byok } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { decryptSecret, encryptSecret } from "@/lib/encryption.server";
import { EncryptionError } from "@/lib/errors/encryption-error";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { createSafeId, rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

type ByokCtx = Kits<[DbKit]>;

const keyPreviewFromSecret = (key: string) => `…${key.slice(-4)}`;

export const listByokFn = Kit.gen(async function* (ctx: ByokCtx, userId: SafeId<"user">) {
  const rows = yield* await ctx.db.run((db) =>
    db.query.byok.findMany({
      where: { userId },
      columns: { activatedAt: true, createdAt: true, id: true, keyPreview: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  );

  return Result.ok(
    rows.map((row) => ({
      activatedAt: row.activatedAt,
      createdAt: row.createdAt,
      id: rawId(row.id),
      keyPreview: row.keyPreview,
      name: row.name,
    })),
  );
});

type CreateByokInput = {
  key: string;
  name: string;
  userId: SafeId<"user">;
};

export const createByokFn = Kit.gen(async function* (ctx: ByokCtx, input: CreateByokInput) {
  const id = createSafeId<"byok">();
  const value = yield* encryptSecret(input.key, {
    byokId: id,
    userId: input.userId,
  });

  yield* await ctx.db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: byok.id })
      .from(byok)
      .where(eq(byok.userId, input.userId))
      .limit(1)
      .for("update");

    await tx.insert(byok).values({
      activatedAt: existing.length === 0 ? new Date() : null,
      id,
      keyPreview: keyPreviewFromSecret(input.key),
      name: input.name,
      userId: input.userId,
      value,
    });
  });

  return Result.ok();
});

type RenameByokInput = {
  id: SafeId<"byok">;
  name: string;
  userId: SafeId<"user">;
};

export const renameByokFn = Kit.gen(async function* (ctx: ByokCtx, input: RenameByokInput) {
  const updated = yield* await ctx.db.run((db) =>
    db
      .update(byok)
      .set({ name: input.name })
      .where(and(eq(byok.id, input.id), eq(byok.userId, input.userId)))
      .returning({ id: byok.id }),
  );

  if (updated.length === 0) {
    return Result.err(toServerFnError.notFound("API key not found"));
  }

  return Result.ok();
});

type DeleteByokInput = {
  id: SafeId<"byok">;
  userId: SafeId<"user">;
};

export const deleteByokFn = Kit.gen(async function* (ctx: ByokCtx, input: DeleteByokInput) {
  const deleted = yield* await ctx.db.transaction(async (tx) => {
    const rows = await tx
      .select({ activatedAt: byok.activatedAt, id: byok.id })
      .from(byok)
      .where(eq(byok.userId, input.userId))
      .for("update");
    const row = rows.find((candidate) => candidate.id === input.id);

    if (!row) {
      return toServerFnError.notFound("API key not found");
    }

    if (row.activatedAt && rows.length > 1) {
      return toServerFnError.badRequest("Activate another API key before deleting the active one");
    }

    await tx.delete(byok).where(eq(byok.id, input.id));
  });

  if (deleted) {
    return Result.err(deleted);
  }

  return Result.ok();
});

type ActivateByokInput = {
  id: SafeId<"byok">;
  userId: SafeId<"user">;
};

export const activateByokFn = Kit.gen(async function* (ctx: ByokCtx, input: ActivateByokInput) {
  const row = yield* await ctx.db.run((db) =>
    db.query.byok.findFirst({
      where: { id: input.id, userId: input.userId },
      columns: { activatedAt: true, id: true },
    }),
  );

  if (!row) {
    return Result.err(toServerFnError.notFound("API key not found"));
  }

  if (row.activatedAt) {
    return Result.ok();
  }

  yield* await ctx.db.transaction(async (tx) => {
    await tx
      .update(byok)
      .set({ activatedAt: null })
      .where(and(eq(byok.userId, input.userId), isNotNull(byok.activatedAt)));

    await tx
      .update(byok)
      .set({ activatedAt: new Date() })
      .where(and(eq(byok.id, input.id), eq(byok.userId, input.userId)));
  });

  return Result.ok();
});

export const reencryptByokFn = Kit.gen(async function* (ctx: ByokCtx, _input: void) {
  const reencrypted = yield* await ctx.db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: byok.id,
        userId: byok.userId,
        value: byok.value,
      })
      .from(byok);

    const values: { id: SafeId<"byok">; value: string }[] = [];

    for (const row of rows) {
      const value = decryptSecret(row.value, { byokId: row.id, userId: row.userId }).andThen(
        (plaintext) => encryptSecret(plaintext, { byokId: row.id, userId: row.userId }),
      );

      if (Result.isError(value)) {
        return value.error;
      }

      values.push({ id: row.id, value: value.value });
    }

    await Promise.all(
      values.map(async ({ id, value }) => tx.update(byok).set({ value }).where(eq(byok.id, id))),
    );

    return rows.length;
  });

  if (EncryptionError.is(reencrypted)) {
    return Result.err(reencrypted);
  }

  return Result.ok({ reencrypted });
});
