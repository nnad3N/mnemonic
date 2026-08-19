import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { T, useGT, useLocale } from "gt-tanstack-start";
import { produce } from "immer";
import { EllipsisVerticalIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import * as v from "valibot";

import { PageContent } from "@/components/page-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@/components/ui/frame";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
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
import { getVisiblePageNumbers } from "@/lib/pagination";
import { reencryptByok } from "@/routes/_protected.settings/-byok.functions";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/routes/_protected.settings/-settings-section";
import {
  ADMIN_USERS_PAGE_SIZE,
  adminQueries,
} from "@/routes/_protected.settings_.admin/-admin-queries";

const adminSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
});

export const Route = createFileRoute("/_protected/settings_/admin/")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") {
      throw redirect({ to: "/settings" });
    }
  },
  component: RouteComponent,
  validateSearch: adminSearchSchema,
});

function RouteComponent() {
  return (
    <PageContent className="gap-3">
      <UsersSection />
      <EncryptionSection />
    </PageContent>
  );
}

const UsersSection = () => {
  const locale = useLocale();
  const page = Route.useSearch({ select: (search) => search.page });
  const users = useQuery(adminQueries.users(page));

  const items = users.data?.users ?? [];
  const totalPages = Math.ceil((users.data?.total ?? 0) / ADMIN_USERS_PAGE_SIZE);
  const showPagination = users.isSuccess && totalPages > 1;

  return (
    <SettingsSection>
      <SettingsSectionHeader>
        <SettingsSectionTitle>
          <T>Users</T>
        </SettingsSectionTitle>
      </SettingsSectionHeader>
      <Frame className="w-full">
        <Table className="w-full" variant="card">
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>
                <T>Name</T>
              </TableHead>
              <TableHead>
                <T>Email</T>
              </TableHead>
              <TableHead>
                <T>Role</T>
              </TableHead>
              <TableHead>
                <T>Joined</T>
              </TableHead>
              <TableHead aria-hidden="true" className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody hoverable={false}>
            {users.isPending && (
              <TableSkeletonRows rows={3} widths={["w-28", "w-40", "w-14", "w-24", null]} />
            )}
            {users.error && (
              <TableErrorRow colSpan={5} onRetry={users.refetch}>
                <T>Could not load users</T>
              </TableErrorRow>
            )}
            {users.isSuccess && items.length === 0 && (
              <TableEmptyRow colSpan={5}>
                <T>No users yet</T>
              </TableEmptyRow>
            )}
            {items.map((item) => (
              <TableRow className="group/admin-user-row" key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.role === "admin" ? <T>Admin</T> : <T>User</T>}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(item.createdAt)}
                </TableCell>
                <TableCell className="p-0 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          className="opacity-0 group-hover/admin-user-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <EllipsisVerticalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        render={
                          <Link params={{ userId: item.id }} to="/settings/admin/$userId/byok" />
                        }
                      >
                        <KeyRoundIcon />
                        <T>View keys</T>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
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
    </SettingsSection>
  );
};

const EncryptionSection = () => {
  const gt = useGT();

  const reencrypt = useMutation({
    mutationFn: async () => reencryptByok(),
    onError: () => {
      toast.error(gt("Could not re-encrypt API keys"));
    },
    onSuccess: ({ reencrypted }) => {
      toast.success(gt("Re-encrypted {count} API keys", { count: reencrypted }));
    },
  });

  return (
    <SettingsSection>
      <SettingsSectionHeader>
        <SettingsSectionTitle>
          <T>Encryption</T>
        </SettingsSectionTitle>
      </SettingsSectionHeader>
      <Frame className="w-full">
        <FrameHeader>
          <FrameTitle>
            <T>Keys at rest</T>
          </FrameTitle>
          <FrameDescription>
            <T>
              Every API key is encrypted with AES-256-GCM before it is stored, bound to the owning
              user and key id so a row cannot be replayed against another account. The cipher key
              comes from the ENCRYPTION_KEYS keyring, whose first entry encrypts new keys while the
              remaining entries stay available to decrypt older ones.
            </T>
          </FrameDescription>
        </FrameHeader>
        <FrameFooter className="flex items-center justify-between gap-3 border-t">
          <FrameDescription>
            <T>Rewrites every stored key with the first entry in the keyring.</T>
          </FrameDescription>
          <Button
            disabled={reencrypt.isPending}
            onClick={() => {
              reencrypt.mutate();
            }}
            variant="outline"
          >
            <T>Re-encrypt keys</T>
          </Button>
        </FrameFooter>
      </Frame>
    </SettingsSection>
  );
};
