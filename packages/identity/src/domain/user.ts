import { type Timestamped, touch } from "@lemma/domain";
import { InvalidUserStateError, UserNotActiveError } from "./errors.js";
import { type IdentityId, identityId, type UserId, userId } from "./ids.js";
import {
  type DisplayName,
  displayName,
  type EmailAddress,
  emailAddress,
  type UserStatus,
  userStatus,
} from "./user-values.js";

export type User = Timestamped & {
  id: UserId;
  identityId: IdentityId;
  email: EmailAddress;
  displayName: DisplayName;
  status: UserStatus;
};

export function createUser(
  input: {
    id: string;
    identityId: string;
    email: string;
    displayName: string;
  },
  at = new Date(),
): User {
  return {
    createdAt: at,
    displayName: displayName(input.displayName),
    email: emailAddress(input.email),
    id: userId(input.id),
    identityId: identityId(input.identityId),
    status: "active",
    updatedAt: at,
  };
}

export function reconstituteUser(input: {
  id: string;
  identityId: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    createdAt: input.createdAt,
    displayName: displayName(input.displayName),
    email: emailAddress(input.email),
    id: userId(input.id),
    identityId: identityId(input.identityId),
    status: userStatus(input.status),
    updatedAt: input.updatedAt,
  };
}

export function updateUserProfile(
  user: User,
  patch: {
    displayName?: DisplayName;
  },
  at = new Date(),
): User {
  assertUserIsMutable(user);

  return {
    ...touch(user, at),
    displayName: patch.displayName
      ? displayName(patch.displayName)
      : user.displayName,
  };
}

export function activateUser(user: User, at = new Date()): User {
  assertUserIsMutable(user);
  return {
    ...touch(user, at),
    status: "active",
  };
}

export function disableUser(user: User, at = new Date()): User {
  assertUserIsMutable(user);
  return {
    ...touch(user, at),
    status: "disabled",
  };
}

export function deleteUser(user: User, at = new Date()): User {
  return {
    ...touch(user, at),
    status: "deleted",
  };
}

export function assertUserIsActive(user: User): void {
  if (user.status !== "active") {
    throw new UserNotActiveError();
  }
}

export function isUserActive(user: Pick<User, "status">): boolean {
  return user.status === "active";
}

export function isUserDeleted(user: Pick<User, "status">): boolean {
  return user.status === "deleted";
}

export function assertUserIsMutable(user: User): void {
  if (user.status === "deleted") {
    throw new InvalidUserStateError("deleted users cannot be modified");
  }
}
