import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { exportSql } from "drizzle-kit/cli";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- augmentation needs interface merging
  interface ProvidedContext {
    pgUrl: string;
    schemaSql: string;
  }
}

export default async function setup(project: TestProject) {
  const exported = await exportSql({
    dialect: "postgresql",
    schema: "./src/db/{schema,auth-schema}.server.ts",
  });

  if (exported.status !== "ok") {
    throw new Error(`drizzle-kit export failed: ${JSON.stringify(exported.error)}`);
  }

  // One container for the whole run; each worker isolates itself with its own database.
  const container = await new PostgreSqlContainer("pgvector/pgvector:pg18").start();

  project.provide("pgUrl", container.getConnectionUri());
  project.provide("schemaSql", exported.statements.join("\n"));

  return async () => {
    await container.stop();
  };
}
