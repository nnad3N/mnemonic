import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { FingerprintIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/better-auth/auth-client";
import {
  AuthError,
  getAuthErrorDescription,
  cancelledPasskeyCodes,
  toAuthError,
} from "@/lib/errors/auth-error";
import { authQueries } from "@/routes/_auth/-auth.functions";

export const Route = createFileRoute("/_auth/sign-in")({
  component: RouteComponent,
});

function RouteComponent() {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signIn.passkey();

      if (error) {
        throw toAuthError(error);
      }
    },
    onError: (error) => {
      const code = AuthError.is(error) ? error.code : undefined;

      if (cancelledPasskeyCodes.is(code)) {
        return;
      }

      toast.error(gt("Something went wrong"), {
        description: getAuthErrorDescription(gt, code),
      });
    },
    // The session query is staleTime Infinity and root beforeLoad reads it from the
    // cache, so navigating before it refetches would bounce back to /sign-in.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueries.session().queryKey });
      await navigate({ to: "/" });
    },
  });

  return (
    <Button
      className="w-full"
      disabled={signIn.isPending}
      onClick={() => {
        signIn.mutate();
      }}
    >
      <FingerprintIcon />
      <T>Sign in with a passkey</T>
    </Button>
  );
}
