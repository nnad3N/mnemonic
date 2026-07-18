import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
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
  const gt = useGT();
  const navigate = useNavigate();
  const { data, isRefetching, refetch } = authClient.useSession();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle className="text-destructive">
          <T>Session error</T>
        </EmptyTitle>
        <EmptyDescription>{getAuthErrorDescription(gt, error.code)}</EmptyDescription>
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
            <T>Try again</T>
          </Button>
          {data ? (
            <Button
              onClick={async () => {
                await authClient.signOut();
                await navigate({ to: "/sign-in" });
              }}
              variant="outline"
            >
              <T>Sign out</T>
            </Button>
          ) : (
            <Button
              onClick={async () => {
                await navigate({ to: "/sign-in" });
              }}
              variant="outline"
            >
              <T>Sign in</T>
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
          <T>Something went wrong</T>
        </EmptyTitle>
        <EmptyDescription>
          <T>If this problem persists, please contact support.</T>
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
                  query.state.fetchStatus === "idle" && query.state.status === "error",
              });
            });
          }}
          variant="default"
        >
          <T>Try again</T>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
