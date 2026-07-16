import * as v from "valibot";

import { safeId } from "@/lib/safe-id";

export const mnemonicRequestContextSchema = v.object({
  userId: safeId<"user">(),
  filter: v.optional(
    v.object({
      topicId: v.optional(safeId<"topic">()),
    }),
  ),
});

export type MnemonicRequestContext = v.InferOutput<typeof mnemonicRequestContextSchema>;
