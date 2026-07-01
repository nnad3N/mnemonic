import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { produce } from "immer";
import {
  AlertCircleIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { searchQuery } from "@/routes/_protected.search/-search-api";
import type {
  SearchConversationResult,
  SearchTopicResult,
} from "@/routes/_protected.search/-search-api";

const searchSchema = v.object({
  q: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/_protected/search")({
  component: RouteComponent,
  validateSearch: searchSchema,
});

const formatUpdatedAt = (updatedAt: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(updatedAt));

/* oxlint-disable func-style */
function RouteComponent() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [debouncedQuery] = useDebounce(q, 300);
  const search = useQuery(searchQuery({ query: debouncedQuery }));
  const hasQuery = debouncedQuery.trim().length > 0;
  const conversations = search.data?.conversations ?? [];
  const topics = search.data?.topics ?? [];
  const hasNoResults =
    search.isSuccess && conversations.length === 0 && topics.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <SearchInput
        onChange={(nextQuery) => {
          void navigate({
            replace: true,
            search: (prev) =>
              produce(prev, (draft) => {
                draft.q = nextQuery;
              }),
            to: ".",
          });
        }}
        value={q}
      />

      {search.isError && (
        <Frame>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircleIcon className="text-destructive" />
              </EmptyMedia>
              <EmptyTitle className="text-destructive">
                {m.search_load_error_title()}
              </EmptyTitle>
              <EmptyDescription>
                {m.search_load_error_description()}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => {
                  void search.refetch();
                }}
                variant="outline"
              >
                {m.common_try_again()}
              </Button>
            </EmptyContent>
          </Empty>
        </Frame>
      )}

      {search.isLoading && (
        <>
          <SearchSection title={m.search_conversations_title()}>
            <SearchSkeleton />
          </SearchSection>
          <SearchSection title={m.search_topics_title()}>
            <SearchSkeleton />
          </SearchSection>
        </>
      )}

      {search.isSuccess && (
        <>
          {(conversations.length > 0 || hasNoResults) && (
            <SearchSection
              title={
                hasQuery
                  ? m.search_conversations_title()
                  : m.search_latest_conversations_title()
              }
            >
              {conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <ConversationResult
                    conversation={conversation}
                    key={conversation.id}
                  />
                ))
              ) : (
                <SearchSectionEmpty>
                  {m.search_no_conversations()}
                </SearchSectionEmpty>
              )}
            </SearchSection>
          )}

          {(topics.length > 0 || hasNoResults) && (
            <SearchSection
              title={
                hasQuery
                  ? m.search_topics_title()
                  : m.search_latest_topics_title()
              }
            >
              {topics.length > 0 ? (
                topics.map((topic) => (
                  <TopicResult key={topic.id} topic={topic} />
                ))
              ) : (
                <SearchSectionEmpty>{m.search_no_topics()}</SearchSectionEmpty>
              )}
            </SearchSection>
          )}
        </>
      )}
    </div>
  );
}

type SearchInputProps = {
  onChange: (value: string) => void;
  value: string;
};

const SearchInput = ({ onChange, value }: SearchInputProps) => (
  <InputGroup>
    <InputGroupAddon align="inline-start">
      <SearchIcon />
    </InputGroupAddon>
    <InputGroupInput
      autoFocus
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={m.search_placeholder()}
      value={value}
    />
    {value.length > 0 && (
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={m.common_cancel()}
          onClick={() => {
            onChange("");
          }}
          size="icon-xs"
          variant="ghost"
        >
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    )}
  </InputGroup>
);

type SearchSectionProps = PropsWithChildren<{
  title: string;
}>;

const SearchSection = ({ children, title }: SearchSectionProps) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
    <Frame className="divide-y overflow-hidden border shadow-sm">
      {children}
    </Frame>
  </section>
);

type SearchResultContentProps = {
  icon: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  title: string;
};

const SearchResultContent = ({
  icon,
  meta,
  trailing,
  title,
}: SearchResultContentProps) => (
  <>
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{title}</div>
      {meta !== undefined && meta !== null && (
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
    {trailing}
  </>
);

type ConversationResultProps = {
  conversation: SearchConversationResult;
};

const ConversationResult = ({ conversation }: ConversationResultProps) => (
  <Link
    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted"
    params={{ threadId: conversation.id }}
    to="/chat/$threadId"
  >
    <SearchResultContent
      icon={<MessageSquareTextIcon className="size-4.5" />}
      meta={<span>{formatUpdatedAt(conversation.updatedAt)}</span>}
      title={conversation.title || m.search_untitled_conversation()}
    />
  </Link>
);

type TopicResultProps = {
  topic: SearchTopicResult;
};

const TopicResult = ({ topic }: TopicResultProps) => (
  <div className="divide-y">
    <Link
      className="flex items-center gap-3 px-3 py-1 transition-colors hover:bg-muted"
      params={{ topicId: topic.id }}
      to="/topic/$topicId/artifacts"
    >
      <SearchResultContent
        icon={<MessagesSquareIcon className="size-4.5" />}
        title={topic.title}
        trailing={
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatUpdatedAt(topic.updatedAt)}
          </span>
        }
      />
    </Link>
    <div>
      {topic.conversations.length > 0 ? (
        topic.conversations.map((conversation) => (
          <Link
            className="flex items-center gap-3 px-3 py-2 pl-14 text-sm transition-colors hover:bg-muted"
            key={conversation.id}
            params={{ threadId: conversation.id }}
            to="/chat/$threadId"
          >
            <MessageSquareTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {conversation.title || m.search_untitled_conversation()}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatUpdatedAt(conversation.updatedAt)}
            </span>
          </Link>
        ))
      ) : (
        <div className="px-3 py-3 pl-14 text-sm text-muted-foreground">
          {m.search_no_conversations()}
        </div>
      )}
    </div>
  </div>
);

const SearchSkeleton = () =>
  Array.from({ length: 4 }, (_, index) => (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2" key={index}>
      <Skeleton className="size-8 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  ));

const SearchSectionEmpty = ({ children }: PropsWithChildren) => (
  <div className="px-3 py-4 text-sm text-muted-foreground">{children}</div>
);
