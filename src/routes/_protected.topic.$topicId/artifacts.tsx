import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { produce } from "immer";
import { AlertCircleIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useDebounce } from "use-debounce";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame } from "@/components/ui/frame";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { m } from "@/paraglide/messages";
import { artifactsQuery } from "@/routes/_protected.topic.$topicId/-artifacts-api/list-artifacts";
import { ArtifactRow } from "@/routes/_protected.topic.$topicId/-artifacts-components/artifact-row";
import { ArtifactSearch } from "@/routes/_protected.topic.$topicId/-artifacts-components/artifact-search";

const PAGE_SIZE = 20;

const artifactsSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  q: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/_protected/topic/$topicId/artifacts")({
  component: RouteComponent,
  validateSearch: artifactsSearchSchema,
});

const MAX_VISIBLE_PAGES = 7;

const getVisiblePageNumbers = (current: number, total: number) => {
  if (total <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const half = Math.floor(MAX_VISIBLE_PAGES / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + MAX_VISIBLE_PAGES - 1);
  start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const getColumns = () =>
  [
    m.common_name(),
    m.common_status(),
    m.common_size(),
    m.common_created(),
    null,
  ] as const;

/* oxlint-disable func-style */
function RouteComponent() {
  const topicId = Route.useParams({ select: (params) => params.topicId });
  const { page, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [debouncedQuery] = useDebounce(q, 300);

  const { data, isError, isLoading, isSuccess, refetch } = useQuery(
    artifactsQuery({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedQuery,
      topicId,
    })
  );

  const columns = getColumns();

  const totalCount = data?.totalCount ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showPagination = isSuccess && totalPages > 1;

  return (
    <div className="flex w-full flex-col gap-4">
      <ArtifactSearch
        onChange={(nextQuery) => {
          void navigate({
            replace: true,
            search: (prev) =>
              produce(prev, (draft) => {
                draft.page = 1;
                draft.q = nextQuery;
              }),
            to: ".",
          });
        }}
        value={q}
      />

      <Frame className="w-full">
        <Table className="w-full" variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) =>
                column ? (
                  <TableHead key={column}>{column}</TableHead>
                ) : (
                  <TableHead
                    key={`column-${index}`}
                    aria-hidden="true"
                    className="w-10"
                  />
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: columns.length }, (__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {isError && (
              <ArtifactsStaticTableRow colSpan={columns.length}>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AlertCircleIcon className="text-destructive" />
                    </EmptyMedia>
                    <EmptyTitle className="text-destructive">
                      {m.artifacts_load_error_title()}
                    </EmptyTitle>
                    <EmptyDescription>
                      {m.artifacts_load_error_description()}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() => {
                        void refetch();
                      }}
                      variant="outline"
                    >
                      {m.common_try_again()}
                    </Button>
                  </EmptyContent>
                </Empty>
              </ArtifactsStaticTableRow>
            )}

            {isSuccess && totalCount === 0 && (
              <ArtifactsStaticTableRow colSpan={columns.length}>
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {debouncedQuery.trim().length > 0
                        ? m.artifacts_no_results()
                        : m.artifacts_empty()}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </ArtifactsStaticTableRow>
            )}

            {isSuccess &&
              items.map((artifact) => (
                <ArtifactRow
                  artifact={artifact}
                  key={artifact.id}
                  topicId={topicId}
                />
              ))}
          </TableBody>
        </Table>
      </Frame>

      {showPagination && (
        <Pagination>
          <PaginationContent>
            {getVisiblePageNumbers(page, totalPages).map((pageNumber) => (
              <PaginationItem key={pageNumber}>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      aria-current={page === pageNumber ? "page" : undefined}
                      from={Route.fullPath}
                      search={(prev) =>
                        produce(prev, (draft) => {
                          draft.page = pageNumber;
                        })
                      }
                      to="."
                    />
                  }
                  size="icon"
                  variant={page === pageNumber ? "outline" : "ghost"}
                >
                  {pageNumber}
                </Button>
              </PaginationItem>
            ))}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

const ArtifactsStaticTableRow = ({
  children,
  colSpan,
}: PropsWithChildren<{ colSpan: number }>) => (
  <TableRow className="group/static">
    <TableCell
      className="group-hover/static:bg-card! dark:group-hover/static:bg-card!"
      colSpan={colSpan}
    >
      {children}
    </TableCell>
  </TableRow>
);
