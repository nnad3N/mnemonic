import { TaggedError } from "better-result";

export class ConfigError extends TaggedError("ConfigError")<{
  message: string;
  reason: "provider-key";
  cause?: unknown;
}> {}

export const toConfigError = {
  providerKey: (message = "No provider key is configured") =>
    new ConfigError({ message, reason: "provider-key" }),
};
