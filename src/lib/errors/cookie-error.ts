import { TaggedError } from "better-result";

export class CookieError extends TaggedError("CookieError")<{
  message: string;
}> {}
