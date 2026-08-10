import { TaggedError } from "better-result";

/**
 * Thrown from a tool's `execute` when the call genuinely failed. Mastra turns it into an
 * `output-error` tool part, so the chat UI marks the call as failed instead of rendering a
 * success label. `message` is the model-safe copy; `cause` keeps the original provider or
 * infrastructure error for the server-side log.
 */
export class ToolError extends TaggedError("ToolError")<{
  message: string;
  cause?: unknown;
}> {}
