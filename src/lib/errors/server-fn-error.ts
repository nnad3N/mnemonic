import { TaggedError } from "better-result";

export class ServerFnError extends TaggedError("ServerFnError")<{
  message: string;
  status: "not-found" | "unauthorized" | "server-error" | "bad-request" | "forbidden";
  cause?: unknown;
}> {}

export const toServerFnError = {
  notFound: (message = "Not found") =>
    new ServerFnError({
      message,
      status: "not-found",
    }),
  unauthorized: (message = "Unauthorized") =>
    new ServerFnError({
      message,
      status: "unauthorized",
    }),
  serverError: (message = "Something went wrong") =>
    new ServerFnError({
      message,
      status: "server-error",
    }),
  badRequest: (message = "Bad request") =>
    new ServerFnError({
      message,
      status: "bad-request",
    }),
  forbidden: (message = "Forbidden") =>
    new ServerFnError({
      message,
      status: "forbidden",
    }),
};
