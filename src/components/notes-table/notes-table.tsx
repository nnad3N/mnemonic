import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-tanstack-start";
import { AlertCircleIcon, SearchIcon, XIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useDebounce } from "use-debounce";

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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { noteQueries } from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
import type { NoteScope } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

import { NoteRow } from "./note-row";

const PAGE_SIZE = 20;

type NotesTableProps = {
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  page: number;
  scope: NoteScope;
  search: string;
};

export const NotesTable = ({
  onPageChange,
  onSearchChange,
  page,
  scope,
  search,
}: NotesTableProps) => {
  const gt = useGT();
  const [debouncedSearch] = useDebounce(search, 300);
  const notes = useQuery(
    noteQueries.list({ page, pageSize: PAGE_SIZE, scope, search: debouncedSearch }),
  );

  const columns = [gt("Title"), gt("Last edited by"), gt("Updated"), null] as const;
  const totalCount = notes.data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="flex w-full flex-col gap-4">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder={gt("Search notes…")}
          value={search}
        />
        {search.length > 0 && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={() => {
                onSearchChange("");
              }}
              size="icon-xs"
              variant="ghost"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <Frame className="w-full">
        <Table className="w-full" variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) =>
                column ? (
                  <TableHead key={column}>{column}</TableHead>
                ) : (
                  <TableHead aria-hidden="true" className="w-10" key={`column-${index}`} />
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: columns.length }, (__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {notes.isError && (
              <NotesStaticRow colSpan={columns.length}>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AlertCircleIcon className="text-destructive" />
                    </EmptyMedia>
                    <EmptyTitle className="text-destructive">
                      <T>Could not load notes</T>
                    </EmptyTitle>
                    <EmptyDescription>
                      <T>Check your connection and try again.</T>
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={async () => {
                        await notes.refetch();
                      }}
                      variant="outline"
                    >
                      <T>Try again</T>
                    </Button>
                  </EmptyContent>
                </Empty>
              </NotesStaticRow>
            )}

            {notes.isSuccess && totalCount === 0 && (
              <NotesStaticRow colSpan={columns.length}>
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {debouncedSearch.trim().length > 0 ? (
                        <T>No notes match your search</T>
                      ) : (
                        <T>No notes here yet</T>
                      )}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </NotesStaticRow>
            )}

            {notes.isSuccess &&
              notes.data.items.map((item) => (
                <NoteRow
                  canMoveToTopic={notes.data.threadTopicId !== null}
                  key={item.id}
                  note={item}
                  scope={scope}
                />
              ))}
          </TableBody>
        </Table>
      </Frame>

      {notes.isSuccess && totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {getVisiblePageNumbers(page, totalPages).map((pageNumber) => (
              <PaginationItem key={pageNumber}>
                <Button
                  aria-current={page === pageNumber ? "page" : undefined}
                  onClick={() => {
                    onPageChange(pageNumber);
                  }}
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
};

type NotesStaticRowProps = PropsWithChildren<{
  colSpan: number;
}>;

const NotesStaticRow = ({ children, colSpan }: NotesStaticRowProps) => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="py-10" colSpan={colSpan}>
      {children}
    </TableCell>
  </TableRow>
);
