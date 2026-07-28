import { createClient } from "@libsql/client";

/** Wipes every non-internal SQLite table in the test database (app + Mastra). */
export const clearDatabase = async () => {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL is required to clear the test database");
  }

  const client = createClient({ url });

  try {
    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    );
    const deletable = tables.rows.flatMap((row) => {
      const name = row.name;
      if (typeof name !== "string") {
        return [];
      }

      // LibSQL vector shadow/meta tables are not safe to empty — wiping them leaves the
      // index unusable until the process recreates it from scratch.
      if (name.includes("vector_idx") || name.includes("libsql_vector")) {
        return [];
      }

      return [name];
    });
    const deletes = deletable.map((name) => `DELETE FROM "${name}";`).join("\n");

    await client.executeMultiple(`
      PRAGMA foreign_keys = OFF;
      ${deletes}
      PRAGMA foreign_keys = ON;
    `);
  } finally {
    client.close();
  }
};
