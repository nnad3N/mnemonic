import { revalidateLogic, useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-tanstack-start";
import type { PropsWithChildren } from "react";
import * as v from "valibot";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type OpenrouterKeyFormProps = {
  onSubmit: (input: { key: string; name: string }) => Promise<void>;
};

export const OpenrouterKeyForm = ({
  children,
  onSubmit,
}: PropsWithChildren<OpenrouterKeyFormProps>) => {
  const gt = useGT();

  const schema = v.object({
    name: v.pipe(v.string(), v.trim(), v.nonEmpty(gt("This field is required."))),
    key: v.pipe(v.string(), v.trim(), v.nonEmpty(gt("This field is required."))),
  });

  const form = useForm({
    defaultValues: { name: "", key: "" },
    onSubmit: async ({ value }) => {
      await onSubmit({ name: value.name.trim(), key: value.key.trim() });
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => (
            <Field field={field}>
              <FieldLabel htmlFor={field.name}>
                <T>Name</T>
              </FieldLabel>
              <Input
                autoComplete="off"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder={gt("Personal")}
                value={field.state.value}
              />
              <FieldError field={field} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <FieldGroup>
        <form.Field name="key">
          {(field) => (
            <Field field={field}>
              <FieldLabel htmlFor={field.name}>
                <T>API key</T>
              </FieldLabel>
              <Input
                autoComplete="off"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder="sk-or-…"
                type="password"
                value={field.state.value}
              />
              <FieldError field={field} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button className="mt-2" disabled={!canSubmit || isSubmitting} type="submit">
            {children}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
