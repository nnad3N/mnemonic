import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { authClient } from "@/lib/better-auth/auth-client";
import { AuthError, getAuthErrorDescription } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

export const ErrorComponent = (props: ErrorComponentProps) => {
  if (AuthError.is(props.error)) {
    return <AuthErrorComponent reset={props.reset} error={props.error} />;
  }
  return <GenericErrorComponent {...props} />;
};

type AuthErrorProps = {
  reset: ErrorComponentProps["reset"];
  error: AuthError;
};

export const AuthErrorComponent = ({ reset, error }: AuthErrorProps) => {
  const navigate = useNavigate();
  const { data, isRefetching, refetch } = authClient.useSession();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle className="text-destructive">
          {m.route_error_session_title()}
        </EmptyTitle>
        <EmptyDescription>
          {getAuthErrorDescription(error.code)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            disabled={isRefetching}
            onClick={async () => {
              reset();
              await refetch();
            }}
            variant="default"
          >
            {m.route_error_try_again()}
          </Button>
          {data ? (
            <Button
              onClick={async () => {
                await authClient.signOut();
                await navigate({ to: "/sign-in" });
              }}
              variant="outline"
            >
              {m.route_error_sign_out()}
            </Button>
          ) : (
            <Button
              onClick={async () => {
                await navigate({ to: "/sign-in" });
              }}
              variant="outline"
            >
              {m.auth_sign_in()}
            </Button>
          )}
        </div>
      </EmptyContent>
    </Empty>
  );
};

export const GenericErrorComponent = ({ reset }: ErrorComponentProps) => {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle className="text-destructive">
          {m.auth_error_generic_title()}
        </EmptyTitle>
        <EmptyDescription>
          {m.route_error_contact_support_if_persists()}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              reset();
              await queryClient.refetchQueries({
                predicate: (query) =>
                  query.state.fetchStatus === "idle" &&
                  query.state.status === "error",
              });
            });
          }}
          variant="default"
        >
          {m.route_error_try_again()}
        </Button>
      </EmptyContent>
    </Empty>
  );
};
