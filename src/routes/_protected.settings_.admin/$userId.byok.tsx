import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { T, useGT, useLocale } from "gt-tanstack-start";
import {
  CheckIcon,
  EllipsisVerticalIcon,
  KeyRoundIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageContent } from "@/components/page-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableErrorRow,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from "@/components/ui/table";
import { ByokNameField } from "@/routes/_protected.settings/-byok-name-field";
import {
  activateUserByok,
  byokQueries,
  createUserByok,
  deleteUserByok,
  renameUserByok,
} from "@/routes/_protected.settings/-byok.functions";
import type { ByokItem } from "@/routes/_protected.settings/-byok.functions";
import { OpenrouterKeyForm } from "@/routes/_protected.settings/-provider-key-form";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/routes/_protected.settings/-settings-section";

export const Route = createFileRoute("/_protected/settings_/admin/$userId/byok")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") {
      throw redirect({ to: "/settings" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const gt = useGT();
  const queryClient = useQueryClient();
  const userId = Route.useParams({ select: (params) => params.userId });
  const [addOpen, setAddOpen] = useState(false);
  const keys = useQuery(byokQueries.user(userId));

  const createKey = useMutation({
    mutationFn: async (input: { key: string; name: string }) =>
      createUserByok({ data: { key: input.key, name: input.name, userId } }),
    onError: () => {
      toast.error(gt("Could not add API key"));
    },
    onSuccess: async () => {
      setAddOpen(false);
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
    },
  });

  const items = keys.data ?? [];

  return (
    <PageContent className="gap-3">
      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionTitle>
            <T>API keys</T>
          </SettingsSectionTitle>
          <Button
            onClick={() => {
              setAddOpen(true);
            }}
            variant="outline"
          >
            <T>Add key</T>
          </Button>
        </SettingsSectionHeader>
        <Frame className="w-full">
          <Table className="w-full" variant="card">
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>
                  <T>Name</T>
                </TableHead>
                <TableHead>
                  <T>Key</T>
                </TableHead>
                <TableHead>
                  <T>Added</T>
                </TableHead>
                <TableHead aria-hidden="true" className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody hoverable={false}>
              {keys.isPending && (
                <TableSkeletonRows rows={1} widths={["w-24", "w-20", "w-28", null]} />
              )}
              {keys.error && (
                <TableErrorRow colSpan={4} onRetry={keys.refetch}>
                  <T>Could not load API keys</T>
                </TableErrorRow>
              )}
              {keys.isSuccess && items.length === 0 && (
                <TableEmptyRow colSpan={4}>
                  <T>No API keys yet</T>
                </TableEmptyRow>
              )}
              {items.map((item) => (
                <AdminByokRow item={item} itemCount={items.length} key={item.id} userId={userId} />
              ))}
            </TableBody>
          </Table>
        </Frame>
      </SettingsSection>

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <T>Add OpenRouter key</T>
            </DialogTitle>
          </DialogHeader>
          <OpenrouterKeyForm onSubmit={async (input) => createKey.mutateAsync(input)}>
            <T>Add key</T>
          </OpenrouterKeyForm>
        </DialogContent>
      </Dialog>
    </PageContent>
  );
}

type AdminByokRowProps = {
  item: ByokItem;
  itemCount: number;
  userId: string;
};

const AdminByokRow = ({ item, itemCount, userId }: AdminByokRowProps) => {
  const gt = useGT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [isRenaming, setIsRenaming] = useState(false);
  const canDelete = !(item.active && itemCount > 1);

  const activateKey = useMutation({
    mutationFn: async () => activateUserByok({ data: { id: item.id, userId } }),
    onError: () => {
      toast.error(gt("Could not activate API key"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
    },
  });

  const renameKey = useMutation({
    mutationFn: async (name: string) => renameUserByok({ data: { id: item.id, name, userId } }),
    onError: () => {
      toast.error(gt("Could not rename API key"));
    },
    onSuccess: async () => {
      setIsRenaming(false);
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async () => deleteUserByok({ data: { id: item.id, userId } }),
    onError: () => {
      toast.error(gt("Could not delete API key"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
    },
  });

  return (
    <TableRow className="group/admin-key-row">
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
          {isRenaming ? (
            <ByokNameField
              isPending={renameKey.isPending}
              name={item.name}
              onRename={(name) => {
                renameKey.mutate(name);
              }}
              onCancel={() => {
                setIsRenaming(false);
              }}
            />
          ) : (
            <span
              className="truncate font-medium"
              onDoubleClick={() => {
                setIsRenaming(true);
              }}
            >
              {item.name}
            </span>
          )}
          {item.active && (
            <Badge variant="outline">
              <T>Active</T>
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">{item.keyPreview}</TableCell>
      <TableCell>
        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(item.createdAt)}
      </TableCell>
      <TableCell className="p-0 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="opacity-0 group-hover/admin-key-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setIsRenaming(true);
              }}
            >
              <PencilIcon />
              <T>Rename</T>
            </DropdownMenuItem>
            {!item.active && (
              <DropdownMenuItem
                disabled={activateKey.isPending}
                onClick={() => {
                  activateKey.mutate();
                }}
              >
                <CheckIcon />
                <T>Set as active</T>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={!canDelete || deleteKey.isPending}
              onClick={() => {
                deleteKey.mutate();
              }}
              variant="destructive"
            >
              <Trash2Icon />
              <T>Delete</T>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};
