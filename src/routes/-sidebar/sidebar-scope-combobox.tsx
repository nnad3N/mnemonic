import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { MessagesSquareIcon, PlusIcon, SquarePenIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";
import {
  createConversation,
  createTopic,
  createTopicThread,
} from "@/routes/_protected.chat.$threadId/-thread-api/thread.functions";

import { navigateToScopeThread } from "./navigate-to-scope-thread";

type SidebarScope = {
  id: string | null;
  title: string;
};

export const SidebarScopeCombobox = () => {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedTopicId = useSearch({ from: "/_protected", select: (search) => search.topic });
  const { data: topics } = useSuspenseQuery(sidebarQueries.topics());
  const conversationsScope: SidebarScope = { id: null, title: gt("Conversations") };
  const scopes: SidebarScope[] = [
    conversationsScope,
    ...topics.map((topic) => ({ id: topic.id, title: topic.title })),
  ];
  const selectedScope =
    scopes.find((scope) => scope.id === (selectedTopicId ?? null)) ?? conversationsScope;
  const selectedTopic = selectedScope.id
    ? { id: selectedScope.id, title: selectedScope.title }
    : undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [typedTitle, setTypedTitle] = useState("");
  const newTopicTitle = typedTitle.trim();
  const anchor = useComboboxAnchor();

  const createTopicMutation = useMutation({
    mutationFn: async () =>
      createTopic({
        data: {
          conversationTitle: gt("New thread"),
          title: newTopicTitle,
        },
      }),
    onError: () => {
      toast.error(gt("Could not create topic"));
    },
    onSuccess: async ({ topicId, threadId }) => {
      await queryClient.invalidateQueries({ queryKey: sidebarQueries.topics().queryKey });
      await queryClient.invalidateQueries({ queryKey: sidebarQueries.threads(topicId).queryKey });
      await navigate({
        params: { threadId },
        replace: true,
        search: (prev) =>
          produce(prev, (draft) => {
            draft.topic = topicId;
          }),
        to: "/chat/$threadId",
      });
      setIsOpen(false);
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      if (selectedTopic) {
        return createTopicThread({ data: { title: gt("New thread"), topicId: selectedTopic.id } });
      }

      return createConversation({ data: { title: gt("New thread") } });
    },
    onError: () => {
      toast.error(gt("Could not create thread"));
    },
    onSuccess: async (thread) => {
      await navigate({ params: { threadId: thread.id }, to: "/chat/$threadId" });
      await queryClient.invalidateQueries({
        queryKey: sidebarQueries.threads(selectedTopic?.id).queryKey,
      });
    },
  });

  return (
    <SidebarMenuItem className="flex items-center">
      <Combobox
        inputValue={isOpen ? typedTitle : selectedScope.title}
        items={scopes}
        itemToStringLabel={(scope) => scope.title}
        isItemEqualToValue={(scope, value) => scope.id === value.id}
        onInputValueChange={setTypedTitle}
        onOpenChange={(open) => {
          setIsOpen(open);
          setTypedTitle("");
        }}
        onValueChange={async (scope) => {
          await navigateToScopeThread({ navigate, queryClient, topicId: scope?.id ?? undefined });
        }}
        open={isOpen}
        value={selectedScope}
      >
        <div className="min-w-0 flex-1" ref={anchor}>
          <ComboboxInput className="w-full bg-transparent" placeholder={selectedScope.title}>
            <InputGroupAddon align="inline-start">
              <MessagesSquareIcon />
            </InputGroupAddon>
          </ComboboxInput>
        </div>
        <ComboboxContent anchor={anchor}>
          <ComboboxList>
            <ComboboxCollection>
              {(scope: SidebarScope) => (
                <ComboboxItem key={scope.id ?? "conversations"} value={scope}>
                  <span className="truncate">{scope.title}</span>
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
          <div className="p-1">
            <Button
              className="w-full justify-start"
              disabled={newTopicTitle.length === 0 || createTopicMutation.isPending}
              onClick={() => {
                createTopicMutation.mutate();
              }}
              size="sm"
              variant="ghost"
            >
              <PlusIcon />
              <T>Create new topic</T>
            </Button>
          </div>
        </ComboboxContent>
      </Combobox>

      <InputGroupButton
        disabled={createThreadMutation.isPending}
        onClick={() => {
          createThreadMutation.mutate();
        }}
        size="icon-sm"
        variant="ghost"
      >
        <SquarePenIcon />
      </InputGroupButton>
    </SidebarMenuItem>
  );
};
