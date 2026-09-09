import { afterEach, describe, expect, it } from "vitest";

import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { createSafeId } from "@/lib/safe-id";
import { mastraVector } from "@/mastra/storage.server";
import { clearDatabase } from "@/test/clear-database";
import { expectOk } from "@/test/result";
import { seedThread, seedUser } from "@/test/seed";

const memory = Kit.get(memoryKit);

/** Matches the index observational memory writes to: `memory_observations_<dimension>`. */
const OBSERVATION_INDEX = "memory_observations_4";
const observationVector = [1, 0, 0, 0];

const listAllThreadIds = async () => {
  const result = await memory.listThreads({ page: 0, perPage: false });

  return expectOk(result).threads.map((thread) => thread.id);
};

const seedObservationVector = async (id: string, metadata: Record<string, string>) => {
  await mastraVector.createIndex({
    dimension: observationVector.length,
    indexName: OBSERVATION_INDEX,
  });
  await mastraVector.upsert({
    ids: [id],
    indexName: OBSERVATION_INDEX,
    metadata: [metadata],
    vectors: [observationVector],
  });
};

const listObservationVectorIds = async () => {
  const results = await mastraVector.query({
    indexName: OBSERVATION_INDEX,
    queryVector: observationVector,
    topK: 100,
  });

  return results.map((result) => result.id).sort();
};

afterEach(async () => {
  await clearDatabase();
});

describe("deleteThread", () => {
  it("deletes the thread together with the subagent threads nested under it", async () => {
    const userId = createSafeId<"user">();
    await seedUser({ id: userId });

    const threadId = await seedThread({ resourceId: userId });
    // Mastra derives a subagent thread id as `${parentThreadId}-${uuid}`, and a nested
    // delegation appends another suffix on top of that.
    const subagentThreadId = await seedThread({
      id: `${threadId}-${crypto.randomUUID()}`,
      resourceId: `${userId}-worker`,
    });
    await seedThread({
      id: `${subagentThreadId}-${crypto.randomUUID()}`,
      resourceId: `${userId}-worker-reader`,
    });
    const otherThreadId = await seedThread({ resourceId: userId });

    expectOk(await memory.deleteThread({ threadId }));

    expect(await listAllThreadIds()).toEqual([otherThreadId]);
  });

  it("deletes the observation embeddings of every thread it removes", async () => {
    const userId = createSafeId<"user">();
    await seedUser({ id: userId });

    const threadId = await seedThread({ resourceId: userId });
    const subagentThreadId = await seedThread({
      id: `${threadId}-${crypto.randomUUID()}`,
      resourceId: `${userId}-worker`,
    });
    const otherThreadId = await seedThread({ resourceId: userId });

    await seedObservationVector("observation-thread", { thread_id: threadId });
    await seedObservationVector("observation-subagent", { thread_id: subagentThreadId });
    await seedObservationVector("observation-other", { thread_id: otherThreadId });

    expectOk(await memory.deleteThread({ threadId }));

    expect(await listObservationVectorIds()).toEqual(["observation-other"]);
  });
});

describe("clearResourceObservations", () => {
  it("deletes the observation embeddings of the resource", async () => {
    const userId = createSafeId<"user">();
    const topicId = createSafeId<"topic">();

    await seedObservationVector("observation-topic", { resource_id: topicId });
    await seedObservationVector("observation-user", { resource_id: userId });

    expectOk(await memory.clearResourceObservations({ resourceId: topicId }));

    expect(await listObservationVectorIds()).toEqual(["observation-user"]);
  });
});
