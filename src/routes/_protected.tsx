import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (context.user === undefined || context.session === undefined) {
      throw redirect({ to: "/sign-in" });
    }

    return { session: context.session, user: context.user };
  },
});
