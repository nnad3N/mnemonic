import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

const ENCRYPTION_KEY_BYTES = 32;
const ENCRYPTION_KEY_HEX_LENGTH = ENCRYPTION_KEY_BYTES * 2;

export type EncryptionKey = {
  id: string;
  key: Buffer;
};

const encryptionKeysSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.transform((value): EncryptionKey[] => {
    const keys: EncryptionKey[] = [];

    for (const rawEntry of value.split(",")) {
      const entry = rawEntry.trim();

      if (entry.length === 0) {
        continue;
      }

      const [id, encodedKey, ...rest] = entry.split(":");

      if (!id || !encodedKey || rest.length > 0 || !/^[\w-]+$/.test(id)) {
        throw new Error('ENCRYPTION_KEYS entry is not in "id:hex" format');
      }

      if (!/^[0-9a-fA-F]+$/.test(encodedKey) || encodedKey.length !== ENCRYPTION_KEY_HEX_LENGTH) {
        throw new Error(
          `ENCRYPTION_KEYS key "${id}" must be ${String(ENCRYPTION_KEY_HEX_LENGTH)} hex characters`,
        );
      }

      keys.push({ id, key: Buffer.from(encodedKey, "hex") });
    }

    if (keys.length === 0) {
      throw new Error("ENCRYPTION_KEYS must contain at least one entry");
    }

    if (new Set(keys.map(({ id }) => id)).size !== keys.length) {
      throw new Error("ENCRYPTION_KEYS ids must be unique");
    }

    return keys;
  }),
);

export const env = createEnv({
  client: {},

  clientPrefix: "VITE_",

  emptyStringAsUndefined: true,

  // Server modules under test run in happy-dom, which defines `window`, so the
  // default check would read them as the client and refuse every server key.
  isServer: typeof window === "undefined" || import.meta.env.MODE === "test",

  runtimeEnv: { ...import.meta.env, ...process.env },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",

  server: {
    ALLOWED_EMAILS: v.optional(v.pipe(v.string(), v.nonEmpty())),
    BETTER_AUTH_URL: v.pipe(v.string(), v.url()),
    DATABASE_AUTH_TOKEN: v.optional(v.pipe(v.string(), v.nonEmpty())),
    DATABASE_URL: v.pipe(v.string(), v.nonEmpty()),
    ENCRYPTION_KEYS: encryptionKeysSchema,
    FIRECRAWL_API_URL: v.pipe(v.string(), v.url()),
    S3_ACCESS_KEY_ID: v.pipe(v.string(), v.nonEmpty()),
    S3_BUCKET: v.pipe(v.string(), v.nonEmpty()),
    S3_ENDPOINT: v.pipe(v.string(), v.url()),
    S3_FORCE_PATH_STYLE: v.picklist(["true", "false"]),
    S3_REGION: v.pipe(v.string(), v.nonEmpty()),
    S3_SECRET_ACCESS_KEY: v.pipe(v.string(), v.nonEmpty()),
  },
});

/** Required server env keys as plain strings — keep Vitest `TEST_ENV` in sync. */
export type RequiredServerEnv = {
  [K in keyof typeof env as undefined extends (typeof env)[K] ? never : K]: string;
};
