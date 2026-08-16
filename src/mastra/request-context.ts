import * as v from "valibot";

import { modelCapabilityLevels } from "@/lib/model-capability";
import { safeId } from "@/lib/safe-id";

export const mnemonicRequestContextSchema = v.object({
  apiKey: v.pipe(v.string(), v.nonEmpty()),
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
