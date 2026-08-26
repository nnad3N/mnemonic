import type { Passkey } from "@better-auth/passkey";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { T, useGT, useLocale } from "gt-tanstack-start";
import { EllipsisVerticalIcon, KeyRoundIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Frame } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
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
import { authClient } from "@/lib/better-auth/auth-client";
import {
  AuthError,
  cancelledPasskeyCodes,
  getAuthErrorDescription,
  toAuthError,
} from "@/lib/errors/auth-error";
import { cn } from "@/lib/utils";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/routes/_protected.settings/-settings-section";

const formatPasskeyDate = (locale: string, date: Date) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

export const PasskeysSection = () => {
  const gt = useGT();
  const passkeys = authClient.useListPasskeys();

  const addPasskey = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey();

      if (result.error) {
        throw toAuthError(result.error);
      }
    },
    onError: (error) => {
      const code = AuthError.is(error) ? error.code : undefined;

      if (cancelledPasskeyCodes.is(code)) {
        return;
      }

      toast.error(gt("Could not add passkey"), {
        description: getAuthErrorDescription(gt, code),
      });
    },
  });

  const items = passkeys.data ?? [];

  return (
    <SettingsSection>
      <SettingsSectionHeader>
        <SettingsSectionTitle>
          <T>Passkeys</T>
        </SettingsSectionTitle>
        <Button
          disabled={addPasskey.isPending}
          onClick={() => {
            addPasskey.mutate();
          }}
          variant="outline"
        >
          <T>Add passkey</T>
        </Button>
      </SettingsSectionHeader>
      <Frame className="w-full">
        <Table className="w-full" variant="card">
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>{gt("Name")}</TableHead>
              <TableHead>{gt("Type")}</TableHead>
              <TableHead>{gt("Added")}</TableHead>
              <TableHead aria-hidden="true" className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody hoverable={false}>
            {passkeys.isPending && (
              <TableSkeletonRows rows={2} widths={["w-28", "w-16", "w-40", null]} />
            )}
            {passkeys.error && (
              <TableErrorRow colSpan={4} onRetry={passkeys.refetch}>
                <T>Could not load passkeys</T>
              </TableErrorRow>
            )}
            {!passkeys.isPending && !passkeys.error && items.length === 0 && (
              <TableEmptyRow colSpan={4}>
                <T>No passkeys yet</T>
              </TableEmptyRow>
            )}
            {items.map((item) => (
              <PasskeyRow isOnlyPasskey={items.length === 1} key={item.id} passkey={item} />
            ))}
          </TableBody>
        </Table>
      </Frame>
    </SettingsSection>
  );
};

type PasskeyRowProps = {
  isOnlyPasskey: boolean;
  passkey: Passkey;
};

const PasskeyRow = ({ isOnlyPasskey, passkey }: PasskeyRowProps) => {
  const gt = useGT();
  const locale = useLocale();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  return (
    <>
      <TableRow className="group/passkey-row">
        <TableCell>
          <div className="flex min-w-0 items-center gap-2">
            <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
            {isRenaming ? (
              <RenamePasskeyField
                passkey={passkey}
                stopRenaming={() => {
                  setIsRenaming(false);
                }}
              />
            ) : (
              <span className="truncate font-medium">{passkey.name ?? gt("Passkey")}</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-full", passkey.backedUp ? "bg-f-green" : "bg-f-blue")}
            />
            {passkey.backedUp ? <T>Synced</T> : <T>This device</T>}
          </Badge>
        </TableCell>
        <TableCell>{formatPasskeyDate(locale, passkey.createdAt)}</TableCell>
        <TableCell className="p-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className="opacity-0 group-hover/passkey-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
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
              <DropdownMenuItem
                disabled={isOnlyPasskey}
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

      <DeletePasskeyDialog onOpenChange={setDeleteOpen} open={deleteOpen} passkey={passkey} />
    </>
  );
};

type RenamePasskeyFieldProps = {
  passkey: Passkey;
  stopRenaming: () => void;
};

const RenamePasskeyField = ({ passkey, stopRenaming }: RenamePasskeyFieldProps) => {
  const gt = useGT();

  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await authClient.passkey.updatePasskey({ id: passkey.id, name });

      if (error) {
        throw toAuthError(error);
      }
    },
    onError: () => {
      toast.error(gt("Could not rename passkey"));
    },
    onSuccess: () => {
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { name: passkey.name ?? "" },
    onSubmit: ({ value }) => {
      const trimmed = value.name.trim();

      if (trimmed.length === 0 || trimmed === passkey.name?.trim()) {
        stopRenaming();
        return;
      }

      renameMutation.mutate(trimmed);
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        name: v.string(),
      }),
    },
  });

  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Input
            autoFocus
            disabled={renameMutation.isPending}
            name={field.name}
            onBlur={async () => {
              field.handleBlur();
              await form.handleSubmit();
            }}
            onChange={(event) => {
              field.handleChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                stopRenaming();
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
    </form>
  );
};

type DeletePasskeyDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  passkey: Passkey;
};

const DeletePasskeyDialog = ({ onOpenChange, open, passkey }: DeletePasskeyDialogProps) => {
  const gt = useGT();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.passkey.deletePasskey({ id: passkey.id });

      if (error) {
        throw toAuthError(error);
      }
    },
    onError: () => {
      toast.error(gt("Could not delete passkey"));
    },
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <T>Delete passkey?</T>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T>You will no longer be able to sign in with this passkey.</T>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            <T>Cancel</T>
          </AlertDialogCancel>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate();
            }}
            variant="destructive"
          >
            <T>Delete</T>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
