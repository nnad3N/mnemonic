import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  client: {},

  clientPrefix: "VITE_",

  emptyStringAsUndefined: true,

  runtimeEnv: { ...import.meta.env, ...process.env },

  server: {
    EXA_API_KEY: v.pipe(v.string(), v.nonEmpty()),
    GOOGLE_GENERATIVE_AI_API_KEY: v.pipe(v.string(), v.nonEmpty()),
    DATABASE_URL: v.pipe(v.string(), v.url()),
    S3_ACCESS_KEY_ID: v.pipe(v.string(), v.nonEmpty()),
    S3_BUCKET: v.pipe(v.string(), v.nonEmpty()),
    S3_ENDPOINT: v.pipe(v.string(), v.url()),
    S3_FORCE_PATH_STYLE: v.picklist(["true", "false"]),
    S3_REGION: v.pipe(v.string(), v.nonEmpty()),
    S3_SECRET_ACCESS_KEY: v.pipe(v.string(), v.nonEmpty()),
    SERVER_URL: v.optional(v.pipe(v.string(), v.url())),
  },
});
