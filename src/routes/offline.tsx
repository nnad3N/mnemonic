import { Link, createFileRoute } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";
import { WifiOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Served from the service worker's cache when a navigation cannot reach the network. The rendered
 * HTML is precached at install time, so this must degrade to plain markup: the retry affordance is
 * a link rather than a click handler, because nothing hydrates without a network.
 */
export const Route = createFileRoute("/offline")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WifiOffIcon />
        </EmptyMedia>
        <EmptyTitle>
          <T>You're offline</T>
        </EmptyTitle>
        <EmptyDescription>
          <T>Mnemonic needs a connection to reach your conversations.</T>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/" />}>
          <T>Try again</T>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
