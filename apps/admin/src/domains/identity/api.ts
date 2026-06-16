import { authedFetch } from "#/lib/custom-fetch";
import type {
  IdentityUser,
  IdentityUserStatus,
  ListIdentityUsersInput,
  Role,
  UserRole,
} from "./model";

type IdentityUserResponse = {
  user: IdentityUser;
};

type ListIdentityUsersResponse = {
  users: IdentityUser[];
};

type RolesResponse = {
  roles: Role[];
};

type UserRolesResponse = {
  roles: UserRole[];
};

export function getCurrentIdentityUser(): Promise<IdentityUser> {
  return authedFetch<IdentityUserResponse>("/api/v1/identity/me").then(
    (response) => response.user,
  );
}

export function listIdentityUsers(
  input: ListIdentityUsersInput = {},
): Promise<ListIdentityUsersResponse> {
  const params = new URLSearchParams();
  if (input.search?.trim()) {
    params.set("search", input.search.trim());
  }
  if (input.status) {
    params.set("status", input.status);
  }
  params.set("limit", String(input.limit ?? 100));

  return authedFetch<ListIdentityUsersResponse>(
    `/api/v1/identity/users?${params.toString()}`,
  );
}

export function updateIdentityUser(input: {
  userId: string;
  displayName: string;
}): Promise<IdentityUser> {
  return authedFetch<IdentityUserResponse>(
    `/api/v1/identity/users/${input.userId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: input.displayName }),
    },
  ).then((response) => response.user);
}

export function setIdentityUserStatus(input: {
  userId: string;
  status: Extract<IdentityUserStatus, "active" | "disabled" | "deleted">;
}): Promise<IdentityUser> {
  if (input.status === "deleted") {
    return authedFetch<IdentityUserResponse>(
      `/api/v1/identity/users/${input.userId}`,
      { method: "DELETE" },
    ).then((response) => response.user);
  }

  const action = input.status === "active" ? "activate" : "disable";

  return authedFetch<IdentityUserResponse>(
    `/api/v1/identity/users/${input.userId}/${action}`,
    { method: "POST" },
  ).then((response) => response.user);
}

export function listIdentityRoles(): Promise<RolesResponse> {
  return authedFetch<RolesResponse>("/api/v1/identity/roles");
}

export function listIdentityUserRoles(
  userId: string,
): Promise<UserRolesResponse> {
  return authedFetch<UserRolesResponse>(
    `/api/v1/identity/users/${userId}/roles`,
  );
}

export function grantIdentityUserRole(input: {
  userId: string;
  roleKey: string;
  expiresAt: string;
}): Promise<void> {
  return authedFetch<void>(`/api/v1/identity/users/${input.userId}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roleKey: input.roleKey,
      expiresAt: input.expiresAt,
    }),
  });
}

export function revokeIdentityUserRole(input: {
  userId: string;
  roleId: string;
}): Promise<void> {
  return authedFetch<void>(
    `/api/v1/identity/users/${input.userId}/roles/${input.roleId}`,
    { method: "DELETE" },
  );
}
