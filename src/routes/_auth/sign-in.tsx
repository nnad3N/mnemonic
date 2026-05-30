import { revalidateLogic, useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import * as v from "valibot";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/better-auth/auth-client";
import { getAuthErrorDescription } from "@/lib/errors/auth-error";
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
        toast.error(m.auth_error_generic_title(), {
          description: getAuthErrorDescription(error.code),
        });
        return;
      }

      await navigate({ to: "/" });
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="email">
          {(field) => (
            <Field field={field}>
              <FieldLabel htmlFor={field.name}>
                {m.auth_email_label()}
              </FieldLabel>
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
              <FieldError field={field} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <FieldGroup>
        <form.Field name="password">
          {(field) => (
            <Field field={field}>
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
              <FieldError field={field} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button className="mt-2 w-full" disabled={!canSubmit} type="submit">
            {m.auth_sign_in_submit()}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
