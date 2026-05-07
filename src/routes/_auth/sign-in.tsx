import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorDescription } from "@/lib/auth-errors";
import { toFormErrors } from "@/lib/form-errors";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

export const Route = createFileRoute("/_auth/sign-in")({
  component: RouteComponent,
});

/* oxlint-disable func-style */
function RouteComponent() {
  const navigate = useNavigate();

  const schema = v.object({
    email: v.pipe(
      v.string(),
      v.nonEmpty(m.auth_validation_required()),
      v.email(m.auth_validation_email_invalid())
    ),
    password: v.pipe(
      v.string(),
      v.nonEmpty(m.auth_validation_required()),
      v.minLength(8, m.auth_validation_password_min())
    ),
  });

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email({
        callbackURL: localizeHref("/"),
        email: value.email,
        password: value.password,
      });

      if (error) {
        toastManager.add({
          description: getAuthErrorDescription(error.code),
          title: m.auth_error_generic_title(),
          type: "error",
        });
        return;
      }

      await navigate({ to: "/" });
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
  });

  const formErrors = useStore(form.store, (s) => toFormErrors(s.fieldMeta));

  return (
    <Form
      className="flex flex-col gap-4"
      errors={formErrors}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <Field name={field.name}>
            <FieldLabel htmlFor={field.name}>{m.auth_email_label()}</FieldLabel>
            <Input
              autoComplete="email"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
              }}
              placeholder={m.auth_email_placeholder()}
              type="email"
              value={field.state.value}
            />
            <FieldError />
          </Field>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <Field name={field.name}>
            <FieldLabel htmlFor={field.name}>
              {m.auth_password_label()}
            </FieldLabel>
            <Input
              autoComplete="current-password"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
              }}
              type="password"
              value={field.state.value}
            />
            <FieldError />
          </Field>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            className="mt-2 w-full"
            disabled={!canSubmit}
            loading={isSubmitting}
            type="submit"
          >
            {m.auth_sign_in_submit()}
          </Button>
        )}
      </form.Subscribe>
    </Form>
  );
}
