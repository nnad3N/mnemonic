import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  activateMyByok,
  byokQueries,
  createMyByok,
  deleteMyByok,
  renameMyByok,
} from "@/routes/_protected.settings/-byok.functions";
import type { ByokItem } from "@/routes/_protected.settings/-byok.functions";
import { OpenrouterKeyForm } from "@/routes/_protected.settings/-provider-key-form";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/routes/_protected.settings/-settings-section";

export const ByokSection = () => {
  const gt = useGT();
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const keys = useQuery(byokQueries.mine());

  const createKey = useMutation({
    mutationFn: async (input: { key: string; name: string }) =>
      createMyByok({ data: { key: input.key, name: input.name } }),
    onError: () => {
      toast.error(gt("Could not add API key"));
    },
    onSuccess: async () => {
      setAddOpen(false);
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
      await router.invalidate();
    },
  });

  const items = keys.data ?? [];

  return (
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
              <ByokRow item={item} itemCount={items.length} key={item.id} />
            ))}
          </TableBody>
        </Table>
      </Frame>

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
    </SettingsSection>
  );
};

type ByokRowProps = {
  item: ByokItem;
  itemCount: number;
};

const ByokRow = ({ item, itemCount }: ByokRowProps) => {
  const gt = useGT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const canDelete = !item.activatedAt || itemCount === 1;

  const renameKey = useMutation({
    mutationFn: async (name: string) => renameMyByok({ data: { id: item.id, name } }),
    onError: () => {
      toast.error(gt("Could not rename API key"));
    },
    onSuccess: async () => {
      setIsRenaming(false);
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
    },
  });

  const activateKey = useMutation({
    mutationFn: async () => activateMyByok({ data: { id: item.id } }),
    onError: () => {
      toast.error(gt("Could not activate API key"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
      await router.invalidate();
    },
  });

  const deleteKey = useMutation({
    mutationFn: async () => deleteMyByok({ data: { id: item.id } }),
    onError: () => {
      toast.error(gt("Could not delete API key"));
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
      await router.invalidate();
    },
  });

  return (
    <>
      <TableRow className="group/byok-row">
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
            {item.activatedAt && (
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
                  className="opacity-0 group-hover/byok-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
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
              {!item.activatedAt && (
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
                disabled={!canDelete}
                onClick={() => {
                  setDeleteOpen(true);
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

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>Delete API key?</T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {item.activatedAt && itemCount === 1 ? (
                <T>The assistant cannot answer without an API key.</T>
              ) : (
                <T>This removes the key from your account.</T>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>
              <T>Cancel</T>
            </AlertDialogCancel>
            <Button
              disabled={deleteKey.isPending}
              onClick={() => {
                deleteKey.mutate();
              }}
              variant="destructive"
            >
              <T>Delete</T>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
