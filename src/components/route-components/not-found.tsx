import { Link } from "@tanstack/react-router";
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
import { m } from "@/paraglide/messages";

export const NotFoundComponent = () => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleQuestionMark aria-hidden="true" className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle className="text-destructive">
          {m.not_found_title()}
        </EmptyTitle>
        <EmptyDescription>{m.not_found_description()}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/" />}>{m.not_found_back_home()}</Button>
      </EmptyContent>
    </Empty>
  );
};
