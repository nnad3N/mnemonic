import * as v from "valibot";

export const mnemonicRequestContextSchema = v.object({
  userId: v.pipe(v.string(), v.nanoid()),
  filter: v.optional(
    v.object({
      topicId: v.optional(v.pipe(v.string(), v.nanoid())),
    })
  ),
});

export type MnemonicRequestContext = v.InferOutput<
  typeof mnemonicRequestContextSchema
>;
