import type { AnyFieldApi } from "@tanstack/react-form";

import { FieldError as FieldErrorComponent } from "@/components/ui/field";

export const FieldError = ({ field }: { field: AnyFieldApi }) => {
  if (!field.state.meta.isTouched || field.state.meta.isValid) {
    return null;
  }

  return <FieldErrorComponent errors={field.state.meta.errors} />;
};
