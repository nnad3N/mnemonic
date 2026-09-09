import { afterEach, describe, expect, it } from "vitest";

import * as Kit from "@/lib/kit";
import { createSafeId } from "@/lib/safe-id";
import { vectorKit } from "@/lib/vector-kit.server";
import { EMBEDDING_DIMENSION } from "@/mastra/models.server";
import { clearDatabase } from "@/test/clear-database";
import { expectOk } from "@/test/result";

const vector = Kit.get(vectorKit);

/** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
const unitVector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => (index === 0 ? 1 : 0));

afterEach(async () => {
  await clearDatabase();
});

describe("indexFile", () => {
  it("replaces the file's earlier vectors instead of leaving extra chunks behind", async () => {
    const fileId = createSafeId<"file">();
    const topicId = createSafeId<"topic">();

    expectOk(
      await vector.indexFile({
        chunks: [
          { page: 1, text: "one" },
          { page: 1, text: "two" },
        ],
        fileId,
        topicId,
        vectors: [unitVector, unitVector],
      }),
    );
    expectOk(
      await vector.indexFile({
        chunks: [{ page: 1, text: "only" }],
        fileId,
        topicId,
        vectors: [unitVector],
      }),
    );

    const hits = expectOk(await vector.search({ scope: { fileId }, topK: 10, vector: unitVector }));

    expect(hits.map((hit) => hit.id)).toEqual([`${fileId}:0`]);
    expect(hits.at(0)?.metadata).toMatchObject({
      chunkIndex: 0,
      fileId,
      page: 1,
      text: "only",
      topicId,
    });
  });
});
