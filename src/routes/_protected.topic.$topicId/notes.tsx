import { createFileRoute } from "@tanstack/react-router";
import { produce } from "immer";
import * as v from "valibot";

import { NotesTable } from "@/components/notes-table/notes-table";

const notesSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  search: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/_protected/topic/$topicId/notes")({
  component: RouteComponent,
  validateSearch: notesSearchSchema,
});

function RouteComponent() {
  const topicId = Route.useParams({ select: (params) => params.topicId });
  const { page, search } = Route.useSearch({
    select: (search) => ({ page: search.page, search: search.search }),
  });
  const navigate = Route.useNavigate();

  return (
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
      scope={{ id: topicId, type: "topic" }}
      search={search}
    />
  );
}
