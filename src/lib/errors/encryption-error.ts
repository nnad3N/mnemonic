import { TaggedError } from "better-result";

export class EncryptionError extends TaggedError("EncryptionError")<{
  message: string;
  cause?: unknown;
}> {}
