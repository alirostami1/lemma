import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getCurrentIdentityUser,
  grantIdentityUserRole,
  listIdentityRoles,
  listIdentityUserRoles,
  listIdentityUsers,
  revokeIdentityUserRole,
  setIdentityUserStatus,
  updateIdentityUser,
} from "./api";
import { identityKeys } from "./keys";
import type { ListIdentityUsersInput } from "./model";

export function useCurrentIdentityUserQuery() {
  return useQuery({
    queryKey: identityKeys.currentUser(),
    queryFn: getCurrentIdentityUser,
  });
}

export function useIdentityUsersQuery(input: ListIdentityUsersInput) {
  return useQuery({
    queryKey: identityKeys.users(input),
    queryFn: () => listIdentityUsers(input),
  });
}

export function useIdentityRolesQuery() {
  return useQuery({
    queryKey: identityKeys.roles(),
    queryFn: listIdentityRoles,
  });
}

export function useIdentityUserRolesQuery(userId: string | null) {
  return useQuery({
    queryKey: identityKeys.userRoles(userId ?? ""),
    queryFn: () => listIdentityUserRoles(userId ?? ""),
    enabled: !!userId,
  });
}

export function useUpdateIdentityUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateIdentityUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useSetIdentityUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setIdentityUserStatus,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useGrantIdentityUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: grantIdentityUserRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useRevokeIdentityUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeIdentityUserRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}
