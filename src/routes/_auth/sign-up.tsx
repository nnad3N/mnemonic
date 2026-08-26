import { useForm, revalidateLogic } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { toast } from "sonner";
import * as v from "valibot";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/better-auth/auth-client";
import type { SignUpContext } from "@/lib/better-auth/auth.server";
import {
  getAuthErrorDescription,
  cancelledPasskeyCodes,
  toAuthError,
} from "@/lib/errors/auth-error";
import type { ToAuthErrorProps } from "@/lib/errors/auth-error";
import type { GT } from "@/lib/gt";
import { authQueries } from "@/routes/_auth/-auth.functions";

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
});

const notifySignUpError = (gt: GT, error: ToAuthErrorProps) => {
  const { code } = toAuthError(error);

  if (!cancelledPasskeyCodes.is(code)) {
    toast.error(gt("Something went wrong"), {
      description: getAuthErrorDescription(gt, code),
    });
  }
};

function RouteComponent() {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const schema = v.object({
    email: v.pipe(
      v.string(),
      v.nonEmpty(gt("This field is required.")),
      v.email(gt("Please enter a valid email address.")),
    ),
    fullName: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty(gt("This field is required.")),
      v.minLength(2, gt("Please enter your full name.")),
    ),
  });

  const form = useForm({
    defaultValues: { email: "", fullName: "" },
    onSubmit: async ({ value }) => {
      const context: SignUpContext = {
        email: value.email,
        name: value.fullName.trim(),
      };

      const registration = await authClient.passkey.addPasskey({
        context: JSON.stringify(context),
      });

      if (registration.error) {
        notifySignUpError(gt, registration.error);
        return;
      }

      // Registering a passkey does not open a session, so the new account has to
      // sign in with the credential it just created.
      const { error } = await authClient.signIn.passkey();

      if (error) {
        notifySignUpError(gt, error);
        return;
      }

      // The session query is staleTime Infinity and root beforeLoad reads it from the
      // cache, so navigating before it refetches would bounce back to /sign-in.
      await queryClient.invalidateQueries({ queryKey: authQueries.session().queryKey });
      await navigate({ to: "/" });
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
        <form.Field name="fullName">
          {(field) => (
            <Field field={field}>
              <FieldLabel htmlFor={field.name}>
                <T>Full name</T>
              </FieldLabel>
              <Input
                autoComplete="name"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder={gt("Jane Doe")}
                type="text"
                value={field.state.value}
              />
              <FieldError field={field} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>

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

      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button className="mt-2 w-full" disabled={!canSubmit} type="submit">
            <T>Create account</T>
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
