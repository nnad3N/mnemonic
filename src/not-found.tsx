import { m } from "@/paraglide/messages";
import { Link } from "@tanstack/react-router";
import { CircleQuestionMark } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const NotFoundPage = (): React.ReactElement => {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Empty className="min-h-0 py-12 md:py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleQuestionMark aria-hidden="true" className="text-destructive" />
            </EmptyMedia>
            <EmptyTitle className="text-destructive">{m.not_found_title()}</EmptyTitle>
            <EmptyDescription>{m.not_found_description()}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/" />}>{m.not_found_back_home()}</Button>
          </EmptyContent>
        </Empty>
      </div>
    </main>
  );
};
