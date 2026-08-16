import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Result } from "better-result";
import type { Result as ResultType } from "better-result";

import { env } from "@/env";
import { EncryptionError } from "@/lib/errors/encryption-error";
import type { SafeId } from "@/lib/safe-id";

const CIPHERTEXT_VERSION = "1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

type SecretAad = {
  byokId: SafeId<"byok">;
  userId: SafeId<"user">;
};

const toAad = ({ byokId, userId }: SecretAad): Buffer => Buffer.from(`${userId}:${byokId}`, "utf8");

export const encryptSecret = (
  plaintext: string,
  aad: SecretAad,
): ResultType<string, EncryptionError> => {
  const [{ key, version }] = env.ENCRYPTION_KEYS;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(toAad(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Result.ok(
    [
      CIPHERTEXT_VERSION,
      String(version),
      iv.toString("hex"),
      ciphertext.toString("hex"),
      tag.toString("hex"),
    ].join("."),
  );
};

export const decryptSecret = (
  value: string,
  aad: SecretAad,
): ResultType<string, EncryptionError> => {
  const [version, keyVersion, ivHex, ciphertextHex, tagHex, ...rest] = value.split(".");

  if (
    version !== CIPHERTEXT_VERSION ||
    !keyVersion ||
    !ivHex ||
    !ciphertextHex ||
    !tagHex ||
    rest.length > 0
  ) {
    return Result.err(
      new EncryptionError({
        message: "Encrypted value is not in version.keyVersion.iv.ciphertext.tag format",
      }),
    );
  }

  const key = env.ENCRYPTION_KEYS.find((entry) => String(entry.version) === keyVersion);

  if (!key) {
    return Result.err(
      new EncryptionError({
        message: `Encrypted value uses key ${keyVersion} which is not in ENCRYPTION_KEYS`,
      }),
    );
  }

  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    return Result.err(
      new EncryptionError({ message: "Encrypted value has invalid IV or auth tag length" }),
    );
  }

  return Result.try({
    try: () => {
      const decipher = createDecipheriv("aes-256-gcm", key.key, iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      decipher.setAAD(toAad(aad));
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    },
    catch: (cause) => new EncryptionError({ cause, message: "Failed to decrypt value" }),
  });
};
