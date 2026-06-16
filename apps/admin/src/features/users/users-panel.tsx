import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { Input } from "@lemma/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import { Skeleton } from "@lemma/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lemma/ui/components/table";
import { Pencil, ShieldPlus, Trash2, UserCheck, UserMinus } from "lucide-react";
import type {
  IdentityUser,
  IdentityUserStatus,
  Role,
  UserRole,
} from "#/domains/identity";
import { formatDate, TableSkeleton, UserStatusBadge } from "#/features/shared";
import type { UserStatusFilter } from "./types";

export function UsersPanel({
  users,
  roles,
  selectedUser,
  selectedRoles,
  search,
  status,
  isLoading,
  rolesLoading,
  errorMessage,
  rolesErrorMessage,
  isMutating,
  onSearchChange,
  onStatusChange,
  onSelectUser,
  onEditUser,
  onGrantRole,
  onSetStatus,
  onRevokeRole,
  onRetry,
}: {
  users: IdentityUser[];
  roles: Role[];
  selectedUser: IdentityUser | null;
  selectedRoles: UserRole[];
  search: string;
  status: UserStatusFilter;
  isLoading: boolean;
  rolesLoading: boolean;
  errorMessage: string | null;
  rolesErrorMessage: string | null;
  isMutating: boolean;
  onSearchChange(value: string): void;
  onStatusChange(value: UserStatusFilter): void;
  onSelectUser(userId: string): void;
  onEditUser(user: IdentityUser): void;
  onGrantRole(user: IdentityUser): void;
  onSetStatus(userId: string, status: IdentityUserStatus): void;
  onRevokeRole(userId: string, roleId: string): void;
  onRetry(): void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>{users.length} users loaded</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="h-8 sm:w-72"
                placeholder="Search users"
                value={search}
                onChange={(event) => onSearchChange(event.currentTarget.value)}
              />
              <Select
                value={status}
                onValueChange={(value) =>
                  onStatusChange(value as UserStatusFilter)
                }
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <TableSkeleton rows={6} /> : null}
          {errorMessage ? (
            <InlineError message={errorMessage} onRetry={onRetry} />
          ) : null}
          {!isLoading && !errorMessage && users.length === 0 ? (
            <EmptyState description="No users match the current filters." />
          ) : null}
          {!isLoading && !errorMessage && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    data-selected={selectedUser?.id === user.id}
                    className="cursor-pointer data-[selected=true]:bg-muted/60"
                    onClick={() => onSelectUser(user.id)}
                  >
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="font-medium">{user.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge status={user.status} />
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Edit user"
                          disabled={isMutating}
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditUser(user);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Grant role"
                          disabled={isMutating || user.status === "deleted"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onGrantRole(user);
                          }}
                        >
                          <ShieldPlus />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <UserDetailPanel
        user={selectedUser}
        roles={roles}
        userRoles={selectedRoles}
        isLoading={rolesLoading}
        errorMessage={rolesErrorMessage}
        isMutating={isMutating}
        onGrantRole={onGrantRole}
        onSetStatus={onSetStatus}
        onRevokeRole={onRevokeRole}
      />
    </div>
  );
}

function UserDetailPanel({
  user,
  roles,
  userRoles,
  isLoading,
  errorMessage,
  isMutating,
  onGrantRole,
  onSetStatus,
  onRevokeRole,
}: {
  user: IdentityUser | null;
  roles: Role[];
  userRoles: UserRole[];
  isLoading: boolean;
  errorMessage: string | null;
  isMutating: boolean;
  onGrantRole(user: IdentityUser): void;
  onSetStatus(userId: string, status: IdentityUserStatus): void;
  onRevokeRole(userId: string, roleId: string): void;
}) {
  if (!user) {
    return (
      <Card>
        <CardContent>
          <EmptyState description="Select a user to manage access." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>{user.displayName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <UserStatusBadge status={user.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {user.status !== "active" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || user.status === "deleted"}
              onClick={() => onSetStatus(user.id, "active")}
            >
              <UserCheck />
              Activate
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating}
              onClick={() => onSetStatus(user.id, "disabled")}
            >
              <UserMinus />
              Disable
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMutating || user.status === "deleted"}
            onClick={() => onSetStatus(user.id, "deleted")}
          >
            <Trash2 />
            Delete
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isMutating || user.status === "deleted"}
            onClick={() => onGrantRole(user)}
          >
            <ShieldPlus />
            Grant role
          </Button>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Roles</h3>
          {isLoading ? <Skeleton className="h-20" /> : null}
          {errorMessage ? <InlineError message={errorMessage} /> : null}
          {!isLoading && !errorMessage && userRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles granted.</p>
          ) : null}
          <div className="grid gap-2">
            {userRoles.map((role) => {
              const roleMeta = roles.find(
                (candidate) => candidate.id === role.roleId,
              );
              return (
                <div
                  key={role.roleId}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="grid gap-1">
                    <div className="font-medium">
                      {roleMeta?.name ?? role.roleKey}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expires {formatDate(role.expiresAt)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() => onRevokeRole(user.id, role.roleId)}
                  >
                    Revoke
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
