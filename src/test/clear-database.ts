import { Client } from "pg";

/** Wipes the test database (app + Mastra). A pgvector index survives a truncate. */
export const clearDatabase = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to clear the test database");
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );

    if (rows.length === 0) {
      return;
    }

    const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
    await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
};
