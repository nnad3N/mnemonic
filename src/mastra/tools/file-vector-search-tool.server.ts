import { createVectorQueryTool } from "@mastra/rag";

import type { ProviderKey } from "@/lib/middleware/resolve-provider-key.server";
import { FILE_EMBEDDINGS_INDEX } from "@/lib/vector-kit.server";
import { getEmbeddingModel } from "@/mastra/config.server";

import { VECTOR_STORE_NAME } from "../storage.server";

export const createFileVectorSearchTool = (providerKey: ProviderKey) =>
  createVectorQueryTool({
    description:
      "Cosine similarity over embedded 512-character chunks of the current topic's files; each hit carries the file id and, when the format has pages, the page.",
    id: "file-vector-search",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getEmbeddingModel(providerKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
