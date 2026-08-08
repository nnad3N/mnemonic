import type { StandardJsonSchema } from "@valibot/to-json-schema";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import type * as v from "valibot";

/**
 * OpenAI-compatible providers require a tool's parameters to declare `type: "object"` at the
 * root, but a `v.variant` input converts to a bare `oneOf` and the whole request is rejected
 * with `invalid_function_parameters`. Restating the object type at the root satisfies that
 * check without changing what the schema accepts, since every variant branch is an object.
 */
export const toToolInputSchema = <
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
  schema: TSchema,
): StandardJsonSchema<v.InferInput<TSchema>, v.InferOutput<TSchema>> => {
  const standard = toStandardJsonSchema(schema);
  const { jsonSchema, ...props } = standard["~standard"];

  return {
    "~standard": {
      ...props,
      jsonSchema: {
        ...jsonSchema,
        input: (options) => ({ type: "object", ...jsonSchema.input(options) }),
      },
    },
  };
};
