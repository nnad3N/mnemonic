import type {
  JsonSchema,
  OverrideSchemaContext,
  StandardJsonSchema,
} from "@valibot/to-json-schema";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import type * as v from "valibot";

/**
 * Gemini's function declarations have no `const`, and a property they cannot read is dropped while
 * its name stays in `required`. A single-value `enum` carrying the type says the same thing about
 * a `v.literal` discriminant, and every other provider reads it too.
 */
const overrideSchema = ({ jsonSchema }: OverrideSchemaContext): JsonSchema | undefined => {
  if (typeof jsonSchema.const !== "string") {
    return undefined;
  }

  const { const: literal, ...rest } = jsonSchema;

  return { ...rest, enum: [literal], type: "string" };
};

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
        input: (options) => ({
          type: "object",
          ...jsonSchema.input({ ...options, libraryOptions: { overrideSchema } }),
        }),
      },
    },
  };
};
