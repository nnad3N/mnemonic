import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { drizzleDb } from "@/db/client.server";
import { file } from "@/db/schema.server";
import { ilike, startsWith } from "@/db/sql.server";
import { createSafeId } from "@/lib/safe-id";
import { clearDatabase } from "@/test/clear-database";
import { seedFile, seedTopic, seedUser } from "@/test/seed";

const seedDisplayNames = async (displayNames: string[]) => {
  const userId = createSafeId<"user">();
  await seedUser({ id: userId });
  const topicId = await seedTopic({ userId });

  for (const displayName of displayNames) {
    await seedFile({ displayName, topicId, userId });
  }
};

const findDisplayNames = async (where: SQL) => {
  const rows = await drizzleDb.select({ displayName: file.displayName }).from(file).where(where);

  return rows.map((row) => row.displayName).sort();
};

afterEach(async () => {
  await clearDatabase();
});

describe("ilike", () => {
  it("matches case-insensitively on a substring", async () => {
    await seedDisplayNames(["Quarterly Report.pdf", "notes.md"]);

    expect(await findDisplayNames(ilike(file.displayName, "quarterly"))).toEqual([
      "Quarterly Report.pdf",
    ]);
  });

  it("treats wildcards in the search value as literal characters", async () => {
    await seedDisplayNames(["report_v1.pdf", "reportXv1.pdf", "100% done.pdf", "100 done.pdf"]);

    expect(await findDisplayNames(ilike(file.displayName, "report_v1"))).toEqual(["report_v1.pdf"]);
    expect(await findDisplayNames(ilike(file.displayName, "100%"))).toEqual(["100% done.pdf"]);
  });
});

describe("startsWith", () => {
  it("treats wildcards in the prefix as literal characters", async () => {
    await seedDisplayNames(["a_c-notes.md", "aXc-notes.md"]);

    expect(await findDisplayNames(startsWith(file.displayName, "a_c-"))).toEqual(["a_c-notes.md"]);
  });
});
