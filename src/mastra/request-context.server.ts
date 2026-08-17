import * as v from "valibot";

import { modelCapabilityLevels } from "@/lib/model-capability";
import { safeId } from "@/lib/safe-id";

/**
 * Carries a *reference* to the user's provider key, never the key itself. Durable runs snapshot
 * the whole request context into `mastra_workflow_snapshot` in plaintext (both as
 * `requestContextEntries` on the workflow input and via `Run.start`), and rehydrate from it on
 * another instance. An id at rest is harmless; the key is decrypted only when a resolver needs it.
 */
export const mnemonicRequestContextSchema = v.object({
  providerKeyId: safeId<"byok">(),
  userId: safeId<"user">(),
  modelCapability: v.picklist(modelCapabilityLevels),
  threadId: v.pipe(v.string(), v.nanoid()),
  filter: v.optional(
    v.object({
      topicId: v.optional(safeId<"topic">()),
    }),
  ),
});

export type MnemonicRequestContext = v.InferOutput<typeof mnemonicRequestContextSchema>;
