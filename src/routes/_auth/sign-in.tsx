import { revalidateLogic, useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { toast } from "sonner";
import * as v from "valibot";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/better-auth/auth-client";
import { getAuthErrorDescription } from "@/lib/errors/auth-error";

export const Route = createFileRoute("/_auth/sign-in")({
  component: RouteComponent,
});

function RouteComponent() {
  const gt = useGT();
  const navigate = useNavigate();

  const schema = v.object({
    email: v.pipe(
      v.string(),
      v.nonEmpty(gt("This field is required.")),
      v.email(gt("Please enter a valid email address.")),
    ),
    password: v.pipe(
      v.string(),
      v.nonEmpty(gt("This field is required.")),
      v.minLength(8, gt("Password must be at least 8 characters.")),
    ),
  });

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email({
        callbackURL: "/",
        email: value.email,
        password: value.password,
      });

      if (error) {
        toast.error(gt("Something went wrong"), {
          description: getAuthErrorDescription(gt, error.code),
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
                <T>Email</T>
              </FieldLabel>
              <Input
                autoComplete="email"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder={gt("you@example.com")}
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
                <T>Password</T>
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
            <T>Sign in</T>
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
