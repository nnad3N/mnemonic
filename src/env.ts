import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  client: {},

  clientPrefix: "VITE_",

  emptyStringAsUndefined: true,

  runtimeEnv: { ...import.meta.env, ...process.env },

  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    SERVER_URL: v.optional(v.pipe(v.string(), v.url())),
  },
});
