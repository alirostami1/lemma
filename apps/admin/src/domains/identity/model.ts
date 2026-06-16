export type IdentityUserStatus = "active" | "disabled" | "deleted";

export type IdentityUser = {
  id: string;
  identityId: string;
  email: string;
  displayName: string;
  status: IdentityUserStatus;
  createdAt: string;
  updatedAt: string;
};

export type Role = {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserRole = {
  userId: string;
  roleId: string;
  roleKey: Role["key"];
  grantedByUserId: string;
  expiresAt: string;
  createdAt: string;
};

export type ListIdentityUsersInput = {
  search?: string;
  status?: IdentityUserStatus;
  limit?: number;
};
