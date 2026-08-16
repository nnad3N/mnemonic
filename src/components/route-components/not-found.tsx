import { Link } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";
import { CircleQuestionMark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const NotFoundComponent = () => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleQuestionMark className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle className="text-destructive">
          <T>Page not found</T>
        </EmptyTitle>
        <EmptyDescription>
          <T>
            This link may be broken, or the page was moved. Check the URL or head back to the start.
          </T>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          <T>Back to home</T>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
