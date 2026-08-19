import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
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
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVisiblePageNumbers } from "@/lib/pagination";
import { FileRow } from "@/routes/_protected.topic.$topicId/-files-components/file-row";
import { FileSearch } from "@/routes/_protected.topic.$topicId/-files-components/file-search";
import { fileQueries } from "@/routes/_protected.topic.$topicId/-files/files.functions";

const PAGE_SIZE = 20;

const filesSearchSchema = v.object({
  search: v.optional(v.string(), ""),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
});

export const Route = createFileRoute("/_protected/topic/$topicId/files")({
  component: RouteComponent,
  validateSearch: filesSearchSchema,
});

function RouteComponent() {
  const gt = useGT();
  const topicId = Route.useParams({ select: (params) => params.topicId });
  const { page, search } = Route.useSearch({
    select: (search) => ({ page: search.page, search: search.search }),
  });
  const navigate = Route.useNavigate();
  const [debouncedQuery] = useDebounce(search, 300);

  const { data, isError, isLoading, isSuccess, refetch } = useQuery(
    fileQueries.list({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedQuery,
      topicId,
    }),
  );

  const columns = [gt("Name"), gt("Status"), gt("Size"), gt("Created"), null] as const;

  const totalCount = data?.totalCount ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showPagination = isSuccess && totalPages > 1;

  return (
    <div className="flex w-full flex-col gap-4">
      <FileSearch
        onChange={(nextQuery) => {
          void navigate({
            replace: true,
            search: (prev) =>
              produce(prev, (draft) => {
                draft.search = nextQuery;
                draft.page = 1;
              }),
            to: ".",
          });
        }}
        value={search}
      />

      <Frame className="w-full">
        <Table className="w-full" variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) =>
                column ? (
                  <TableHead key={column}>{column}</TableHead>
                ) : (
                  <TableHead key={`column-${index}`} aria-hidden="true" className="w-10" />
                ),
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
              <FilesStaticTableRow colSpan={columns.length}>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AlertCircleIcon className="text-destructive" />
                    </EmptyMedia>
                    <EmptyTitle className="text-destructive">
                      <T>Could not load files</T>
                    </EmptyTitle>
                    <EmptyDescription>
                      <T>
                        We couldn't load the files for this topic. Check your connection and try
                        again.
                      </T>
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() => {
                        void refetch();
                      }}
                      variant="outline"
                    >
                      <T>Try again</T>
                    </Button>
                  </EmptyContent>
                </Empty>
              </FilesStaticTableRow>
            )}

            {isSuccess && totalCount === 0 && (
              <FilesStaticTableRow colSpan={columns.length}>
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {debouncedQuery.trim().length > 0 ? (
                        <T>No files match your search</T>
                      ) : (
                        <T>No files in this topic yet</T>
                      )}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </FilesStaticTableRow>
            )}

            {isSuccess &&
              items.map((fileItem) => (
                <FileRow file={fileItem} key={fileItem.id} topicId={topicId} />
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

const FilesStaticTableRow = ({ children, colSpan }: PropsWithChildren<{ colSpan: number }>) => (
  <TableRow className="group/static">
    <TableCell
      className="group-hover/static:bg-card! dark:group-hover/static:bg-card!"
      colSpan={colSpan}
    >
      {children}
    </TableCell>
  </TableRow>
);
