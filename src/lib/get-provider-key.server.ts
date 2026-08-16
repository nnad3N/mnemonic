import { Result } from "better-result";
import type { Result as ResultType } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import type { DatabaseError } from "@/lib/db-kit.server";
import { decryptSecret } from "@/lib/encryption.server";
import { ConfigError, toConfigError } from "@/lib/errors/config-error";
import type { EncryptionError } from "@/lib/errors/encryption-error";
import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";

export type GetProviderKeyError = DatabaseError | EncryptionError | ConfigError;

export const getProviderKey = async (
  userId: SafeId<"user">,
): Promise<ResultType<string, GetProviderKeyError>> => {
  const result = await Kit.get(dbKit).run((db) =>
    db.query.byok.findFirst({
      where: { userId, active: true },
      columns: { id: true, userId: true, value: true },
    }),
  );

  if (Result.isError(result)) {
    return result;
  }

  const row = result.value;

  if (!row) {
    return Result.err(toConfigError.providerKey("No provider key is configured for this user"));
  }

  const apiKey = decryptSecret(row.value, { byokId: row.id, userId: row.userId });

  if (Result.isError(apiKey)) {
    return apiKey;
  }

  return Result.ok(apiKey.value);
};
