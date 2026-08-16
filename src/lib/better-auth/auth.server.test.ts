import { eq } from "drizzle-orm";
import { afterEach, assert, describe, expect, it } from "vitest";

import { passkey, user } from "@/db/auth-schema.server";
import { drizzleDb } from "@/db/client.server";
import { auth } from "@/lib/better-auth/auth.server";
import { clearDatabase } from "@/test/clear-database";

const EMAIL = "passkey-user@example.com";

const generateRegistrationOptions = async () =>
  auth.api.generatePasskeyRegistrationOptions({
    query: { context: JSON.stringify({ email: EMAIL, name: "Passkey User" }) },
  });

const findUserIds = async () => {
  const rows = await drizzleDb.select({ id: user.id }).from(user).where(eq(user.email, EMAIL));

  return rows.map((row) => row.id);
};

const seedPasskeyFor = async (userId: string) => {
  await drizzleDb.insert(passkey).values({
    backedUp: false,
    counter: 0,
    createdAt: new Date(),
    credentialID: crypto.randomUUID(),
    deviceType: "singleDevice",
    id: crypto.randomUUID(),
    publicKey: "test-public-key",
    userId,
  });
};

afterEach(async () => {
  await clearDatabase();
});

describe("passkey registration resolveUser", () => {
  it("creates an account for an unknown email", async () => {
    await generateRegistrationOptions();

    expect(await findUserIds()).toHaveLength(1);
  });

  it("reuses an account whose registration was abandoned before a passkey existed", async () => {
    await generateRegistrationOptions();
    const [abandonedUserId] = await findUserIds();
    assert(abandonedUserId, "Expected the abandoned registration to have created a user");

    await generateRegistrationOptions();

    expect(await findUserIds()).toEqual([abandonedUserId]);
  });

  it("rejects an email that already owns a passkey", async () => {
    await generateRegistrationOptions();
    const [existingUserId] = await findUserIds();
    assert(existingUserId, "Expected the first registration to have created a user");
    await seedPasskeyFor(existingUserId);

    await expect(generateRegistrationOptions()).rejects.toThrow(
      "An account with that email already exists",
    );

    expect(await findUserIds()).toEqual([existingUserId]);
  });
});
