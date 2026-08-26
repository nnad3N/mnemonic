import { createFileRoute } from "@tanstack/react-router";
import { produce } from "immer";
import * as v from "valibot";

import { NotesTable } from "@/components/notes-table/notes-table";
import { PageContent } from "@/components/page-content";

const notesSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  search: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/_protected/chat/$threadId_/notes")({
  component: RouteComponent,
  validateSearch: notesSearchSchema,
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });
  const { page, search } = Route.useSearch({
    select: (search) => ({ page: search.page, search: search.search }),
  });
  const navigate = Route.useNavigate();

  return (
    <PageContent>
      <NotesTable
        onPageChange={async (nextPage) =>
          navigate({
            search: (prev) =>
              produce(prev, (draft) => {
                draft.page = nextPage;
              }),
            to: ".",
          })
        }
        onSearchChange={async (nextSearch) =>
          navigate({
            replace: true,
            search: (prev) =>
              produce(prev, (draft) => {
                draft.page = 1;
                draft.search = nextSearch;
              }),
            to: ".",
          })
        }
        page={page}
        scope={{ id: threadId, type: "thread" }}
        search={search}
      />
    </PageContent>
  );
}
