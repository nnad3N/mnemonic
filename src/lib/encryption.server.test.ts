import { createCipheriv } from "node:crypto";

import { describe, expect, it } from "vitest";

import { toSafeId } from "@/lib/safe-id";
import { expectErr, expectOk } from "@/test/result";

import { decryptSecret, encryptSecret } from "./encryption.server";

const aad = {
  // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test fixtures.
  byokId: toSafeId<"byok">("byok_test"),
  // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test fixtures.
  userId: toSafeId<"user">("user_test"),
};

describe("encryption", () => {
  it("encrypts with the first keyring entry and round-trips", () => {
    const value = expectOk(encryptSecret("sk-or-v1-secret", aad));

    expect(value.startsWith("1.2.")).toBe(true);
    expect(expectOk(decryptSecret(value, aad))).toBe("sk-or-v1-secret");
  });

  it("decrypts values encrypted with a non-first key", () => {
    const version1Key = Buffer.alloc(32, 1);
    const iv = Buffer.alloc(12, 2);
    const cipher = createCipheriv("aes-256-gcm", version1Key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(`${aad.userId}:${aad.byokId}`, "utf8"));
    const ciphertext = Buffer.concat([cipher.update("old-secret", "utf8"), cipher.final()]);
    const value = [
      "1",
      "1",
      iv.toString("hex"),
      ciphertext.toString("hex"),
      cipher.getAuthTag().toString("hex"),
    ].join(".");

    expect(expectOk(decryptSecret(value, aad))).toBe("old-secret");
  });

  it("errors when the value's key version is not in the keyring", () => {
    const value = expectOk(encryptSecret("secret", aad)).replace(/^1\.2\./, "1.99.");

    expect(expectErr(decryptSecret(value, aad)).message).toMatch(/99/);
  });

  it("errors when AAD does not match", () => {
    const value = expectOk(encryptSecret("secret", aad));

    expect(
      expectErr(
        decryptSecret(value, {
          ...aad,
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test fixtures.
          userId: toSafeId<"user">("other_user"),
        }),
      ).message,
    ).toMatch(/Failed to decrypt/);
  });

  it("errors when the IV length is wrong", () => {
    const value = expectOk(encryptSecret("secret", aad));
    const [version, keyVersion, , ciphertext, tag] = value.split(".");
    const truncated = [version, keyVersion, "ab".repeat(8), ciphertext, tag].join(".");

    expect(expectErr(decryptSecret(truncated, aad)).message).toMatch(/IV or auth tag/);
  });

  it("errors when the auth tag length is wrong", () => {
    const value = expectOk(encryptSecret("secret", aad));
    const [version, keyVersion, iv, ciphertext] = value.split(".");
    const truncated = [version, keyVersion, iv, ciphertext, "ab".repeat(8)].join(".");

    expect(expectErr(decryptSecret(truncated, aad)).message).toMatch(/IV or auth tag/);
  });

  it("errors when the version prefix is wrong", () => {
    const value = expectOk(encryptSecret("secret", aad)).replace(/^1\./, "2.");

    expect(expectErr(decryptSecret(value, aad)).message).toMatch(/version\.keyVersion/);
  });
});
