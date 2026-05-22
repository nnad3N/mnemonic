import type { Form } from "@base-ui/react/form";
import type { AnyFieldMeta } from "@tanstack/react-form";
import { panic } from "better-result";

export type FormErrors = NonNullable<Form.Props["errors"]>;

const fieldErrorsToString = (errors: readonly unknown[]): string | null => {
  if (errors.length === 0) {
    return null;
  }

  return errors
    .map((error) => {
      if (typeof error === "string") {
        return error;
      }

      if (typeof error === "object" && error && "message" in error) {
        return error.message;
      }

      return panic("Failed to convert field errors to string");
    })
    .join(", ");
};

export const toFormErrors = (
  errors: Partial<Record<string, AnyFieldMeta>>
): FormErrors | undefined => {
  const errorsMap = new Map<string, string>();

  for (const [key, value] of Object.entries(errors)) {
    if (!value) {
      continue;
    }

    const errorsString = fieldErrorsToString(value.errors);

    if (errorsString) {
      errorsMap.set(key, errorsString);
    }
  }

  if (errorsMap.size === 0) {
    return undefined;
  }

  return Object.fromEntries(errorsMap);
};
