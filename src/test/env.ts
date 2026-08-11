import type { RequiredServerEnv } from "@/env";

/** Dummy env for Vitest. Values are never used for real I/O at construction time. */
export const TEST_ENV = {
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "file:./node_modules/.vitest/placeholder.db",
  FIRECRAWL_API_URL: "http://127.0.0.1:4010",
  OPENROUTER_API_KEY: "test-openrouter-key",
  S3_ACCESS_KEY_ID: "test-access-key",
  S3_BUCKET: "test-bucket",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_FORCE_PATH_STYLE: "true",
  S3_REGION: "us-east-1",
  S3_SECRET_ACCESS_KEY: "test-secret-key",
} as const satisfies RequiredServerEnv;

export const SCHEMA_SQL_PATH = "node_modules/.vitest/schema.sql";
export const TEST_DB_DIR = "node_modules/.vitest/db";
