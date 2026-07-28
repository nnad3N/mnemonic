import { createClient } from "@libsql/client";

const isVectorTable = (name: string, sql: string) =>
  sql.includes("F32_BLOB") || name.includes("vector_idx") || name.includes("libsql_vector");

/**
 * Wipes the test database (app + Mastra).
 * Vector / F32_BLOB tables must be DROPped — DELETE leaves LibSQL shadow state
 * corrupt until the index is recreated via createIndex.
 */
export const clearDatabase = async () => {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL is required to clear the test database");
  }

  const client = createClient({ url });

  try {
    const tables = await client.execute(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    );

    const statements: string[] = [];

    for (const row of tables.rows) {
      const name = row.name;
      if (typeof name !== "string") {
        continue;
      }

      const sql = typeof row.sql === "string" ? row.sql : "";

      if (isVectorTable(name, sql)) {
        statements.push(`DROP TABLE IF EXISTS "${name}";`);
        continue;
      }

      statements.push(`DELETE FROM "${name}";`);
    }

    if (statements.length === 0) {
      return;
    }

    await client.executeMultiple(`
      PRAGMA foreign_keys = OFF;
      ${statements.join("\n")}
      PRAGMA foreign_keys = ON;
    `);
  } finally {
    client.close();
  }
};
