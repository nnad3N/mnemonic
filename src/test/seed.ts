import { Result } from "better-result";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema";
import { file, topic } from "@/db/schema";
import type { FileStatus } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { SafeId } from "@/lib/safe-id";
import { toSafeId } from "@/lib/safe-id";

export { clearDatabase } from "./clear-database";

const db = Kit.get(dbKit);
const memory = Kit.get(memoryKit);

export const seedUser = async (overrides?: { id?: string; email?: string; name?: string }) => {
  const id = overrides?.id ?? nanoid();
  const now = new Date();

  const result = await db.run((db) =>
    db.insert(user).values({
      id,
      name: overrides?.name ?? "Test User",
      email: overrides?.email ?? `${id}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    }),
  );

  if (Result.isError(result)) {
    throw result.error;
  }

  // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test seeder brands known inserted ids.
  return toSafeId<"user">(id);
};

export const seedTopic = async (input: {
  userId: SafeId<"user">;
  id?: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  const id = input.id ?? nanoid();
  const now = new Date();

  const result = await db.run((db) =>
    db.insert(topic).values({
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test seeder brands known inserted ids.
      id: toSafeId<"topic">(id),
      userId: input.userId,
      title: input.title ?? "Test Topic",
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }),
  );

  if (Result.isError(result)) {
    throw result.error;
  }

  // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test seeder brands known inserted ids.
  return toSafeId<"topic">(id);
};

export const seedFile = async (input: {
  userId: SafeId<"user">;
  topicId: SafeId<"topic">;
  id?: string;
  displayName?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  s3Key?: string;
  status?: FileStatus;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  const id = input.id ?? nanoid();
  const s3Key = input.s3Key ?? `uploads/${id}`;
  const now = new Date();

  const result = await db.run((db) =>
    db.insert(file).values({
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test seeder brands known inserted ids.
      id: toSafeId<"file">(id),
      userId: input.userId,
      topicId: input.topicId,
      displayName: input.displayName ?? "doc.pdf",
      mimeType: input.mimeType ?? "application/pdf",
      sizeBytes: input.sizeBytes ?? 100,
      sha256: input.sha256 ?? id.padEnd(64, "0").slice(0, 64),
      s3Key,
      status: input.status ?? "uploading",
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }),
  );

  if (Result.isError(result)) {
    throw result.error;
  }

  return {
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test seeder brands known inserted ids.
    fileId: toSafeId<"file">(id),
    s3Key,
  };
};

export const seedThread = async (input: {
  resourceId: string;
  title?: string;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  const id = input.id ?? nanoid();
  const now = new Date();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;

  const result = await memory.saveThread({
    thread: {
      id,
      resourceId: input.resourceId,
      title: input.title ?? "Test Conversation",
      createdAt,
      updatedAt,
    },
  });

  if (Result.isError(result)) {
    throw result.error;
  }

  return result.value.id;
};
