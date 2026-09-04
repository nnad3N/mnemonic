import { Result, TaggedError } from "better-result";

import type { Provider } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { decryptSecret } from "@/lib/encryption.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";

class ProviderKeyNotFoundError extends TaggedError("ProviderKeyNotFoundError")<{
  message: string;
}> {}

type Ctx = Kits<[DbKit]>;

export type ProviderKey = {
  key: string;
  provider: Provider;
};

export const resolveProviderKey = Kit.gen(async function* (ctx: Ctx, userId: SafeId<"user">) {
  const byok = yield* await ctx.db.run((db) =>
    db.query.byok.findFirst({
      where: { userId, activatedAt: { isNotNull: true } },
      columns: { id: true, provider: true, value: true },
    }),
  );

  if (!byok) {
    return Result.err(
      new ProviderKeyNotFoundError({ message: "No provider key is configured for this user" }),
    );
  }

  const key = yield* decryptSecret(byok.value, { byokId: byok.id, userId });

  return Result.ok({ id: byok.id, key, provider: byok.provider });
});

export const resolveProviderKeyById = Kit.gen(async function* (ctx: Ctx, id: SafeId<"byok">) {
  const byok = yield* await ctx.db.run((db) =>
    db.query.byok.findFirst({
      where: { id },
      columns: { provider: true, userId: true, value: true },
    }),
  );

  if (!byok) {
    return Result.err(new ProviderKeyNotFoundError({ message: "Provider key no longer exists" }));
  }

  const key = yield* decryptSecret(byok.value, { byokId: id, userId: byok.userId });

  return Result.ok({ id, key, provider: byok.provider });
});
