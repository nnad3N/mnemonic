import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { expect } from "vitest";

/** Assert Ok and return the narrowed success value. */
export const expectOk = <T, E>(result: ResultType<T, E>): T => {
  expect(Result.isOk(result)).toBe(true);
  if (Result.isError(result)) {
    throw result.error;
  }

  return result.value;
};

/** Assert Err and return the narrowed error value. */
export const expectErr = <T, E>(result: ResultType<T, E>): E => {
  expect(Result.isError(result)).toBe(true);
  if (Result.isOk(result)) {
    throw new Error("Expected Err result, got Ok");
  }

  return result.error;
};
