import { getRouteApi } from "@tanstack/react-router";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";

import { cn } from "@/lib/utils";

import type { ThreadInputLocation } from "../../-thread-store";
import { ComposerFooter } from "./composer-footer";
import { getThreadEditorId, threadEditorPlugins } from "./plate";

type ThreadComposerProps = {
  location: ThreadInputLocation;
};

const Route = getRouteApi("/_protected/chat/$threadId");

export const ThreadComposer = ({ location }: ThreadComposerProps) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const editorId = getThreadEditorId(threadId, location);

  const editor = usePlateEditor({
    id: editorId,
    plugins: threadEditorPlugins,
    autoSelect: "end",
  });

  return (
    <div
      className={cn(
        "w-full max-w-md min-w-0 rounded-2xl border bg-input/50 p-2 text-base md:text-sm"
      )}
    >
      <Plate editor={editor}>
        <PlateContent className="outline-none" />
      </Plate>
      <ComposerFooter location={location} />
    </div>
  );
};
