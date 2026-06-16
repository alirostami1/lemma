import { toast } from "@lemma/ui/components/sonner";
import { useEffect, useMemo, useState } from "react";
import {
  type IdentityUser,
  type IdentityUserStatus,
  useGrantIdentityUserRoleMutation,
  useIdentityRolesQuery,
  useIdentityUserRolesQuery,
  useIdentityUsersQuery,
  useRevokeIdentityUserRoleMutation,
  useSetIdentityUserStatusMutation,
  useUpdateIdentityUserMutation,
} from "#/domains/identity";
import { getUserFacingApiErrorMessage } from "#/lib/errors/api-error";
import type { UserStatusFilter } from "./types";

export function useUsersController() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<IdentityUser | null>(null);
  const [grantingUser, setGrantingUser] = useState<IdentityUser | null>(null);

  const usersInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === "all" ? undefined : status,
      limit: 100,
    }),
    [search, status],
  );

  const users = useIdentityUsersQuery(usersInput);
  const roles = useIdentityRolesQuery();
  const selectedUser =
    users.data?.users.find((user) => user.id === selectedUserId) ??
    users.data?.users[0] ??
    null;
  const selectedRoles = useIdentityUserRolesQuery(selectedUser?.id ?? null);
  const grantingUserRoles = useIdentityUserRolesQuery(grantingUser?.id ?? null);
  const updateUser = useUpdateIdentityUserMutation();
  const setUserStatus = useSetIdentityUserStatusMutation();
  const grantRole = useGrantIdentityUserRoleMutation();
  const revokeRole = useRevokeIdentityUserRoleMutation();

  useEffect(() => {
    if (!selectedUserId && users.data?.users[0]) {
      setSelectedUserId(users.data.users[0].id);
    }
  }, [selectedUserId, users.data]);

  const isMutating =
    updateUser.isPending ||
    setUserStatus.isPending ||
    grantRole.isPending ||
    revokeRole.isPending;

  return {
    users: users.data?.users ?? [],
    roles: roles.data?.roles ?? [],
    selectedUser,
    selectedRoles: selectedRoles.data?.roles ?? [],
    grantingUser,
    grantingUserRoles: grantingUserRoles.data?.roles ?? [],
    search,
    status,
    isLoading: users.isLoading,
    rolesLoading: selectedRoles.isLoading,
    grantRolesLoading: grantingUserRoles.isLoading,
    rolesListLoading: roles.isLoading,
    isFetching: users.isFetching || roles.isFetching || selectedRoles.isFetching,
    isMutating,
    isSavingUser: updateUser.isPending,
    isGrantingRole: grantRole.isPending,
    errorMessage: getErrorMessage(users.error),
    rolesErrorMessage: getErrorMessage(selectedRoles.error),
    rolesListErrorMessage: getErrorMessage(roles.error),
    setSearch,
    setStatus,
    selectUser: setSelectedUserId,
    editUser: setEditingUser,
    closeEditUser: () => setEditingUser(null),
    openGrantRole: (user: IdentityUser) => {
      setSelectedUserId(user.id);
      setGrantingUser(user);
    },
    closeGrantRole: () => setGrantingUser(null),
    retryUsers: () => void users.refetch(),
    retryRoles: () => void roles.refetch(),
    refresh: () => {
      void users.refetch();
      void roles.refetch();
      void selectedRoles.refetch();
      void grantingUserRoles.refetch();
    },
    setUserStatus: (userId: string, nextStatus: IdentityUserStatus) => {
      setUserStatus.mutate(
        { userId, status: nextStatus },
        {
          onSuccess: () => toast.success("User status updated."),
          onError: (error) =>
            toast.error("User status could not be updated.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      );
    },
    revokeRole: (userId: string, roleId: string) => {
      revokeRole.mutate(
        { userId, roleId },
        {
          onSuccess: () => toast.success("Role revoked."),
          onError: (error) =>
            toast.error("Role could not be revoked.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      );
    },
    saveUser: (displayName: string) => {
      if (!editingUser) {
        return;
      }
      updateUser.mutate(
        { userId: editingUser.id, displayName },
        {
          onSuccess: () => {
            toast.success("User updated.");
            setEditingUser(null);
          },
          onError: (error) =>
            toast.error("User could not be updated.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      );
    },
    grantUserRole: (roleKey: string, expiresAt: string) => {
      if (!grantingUser) {
        return;
      }
      grantRole.mutate(
        { userId: grantingUser.id, roleKey, expiresAt },
        {
          onSuccess: () => {
            toast.success("Role granted.");
            setGrantingUser(null);
          },
          onError: (error) =>
            toast.error("Role could not be granted.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      );
    },
    editingUser,
  };
}

function getErrorMessage(error: unknown): string | null {
  return error ? getUserFacingApiErrorMessage(error) : null;
}
