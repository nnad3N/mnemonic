import { panic, Result } from "better-result";
import type { Result as ResultType } from "better-result";

import { CookieError } from "@/lib/errors/cookie-error";

type SetOptions = {
  maxAge?: number;
  path?: string;
};

const assertBrowser = () => {
  if (typeof document === "undefined") {
    panic("Cookies are only available in the browser");
  }
};

export const get = (name: string): ResultType<string, CookieError> => {
  assertBrowser();

  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));

  if (!entry) {
    return Result.err(new CookieError({ message: `Cookie "${name}" is not set` }));
  }

  return Result.ok(decodeURIComponent(entry.slice(prefix.length)));
};

type SetInput = {
  name: string;
  value: string;
  options?: SetOptions;
};

export const set = ({ name, value, options }: SetInput) => {
  assertBrowser();

  const attributes = [`${name}=${encodeURIComponent(value)}`, `path=${options?.path ?? "/"}`];

  if (options?.maxAge !== undefined) {
    attributes.push(`max-age=${options.maxAge}`);
  }

  document.cookie = attributes.join("; ");
};
