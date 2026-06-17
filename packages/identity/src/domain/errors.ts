import { DomainError } from "@lemma/error";

export class InvalidDomainValueError extends DomainError {
  readonly domainCode = "INVALID_DOMAIN_VALUE";
}

export class InvalidUserStateError extends DomainError {
  readonly domainCode = "INVALID_USER_STATE";

  constructor(message = "invalid user state") {
    super(message);
  }
}

export class InvalidRoleGrantError extends DomainError {
  readonly domainCode = "INVALID_ROLE_GRANT";

  constructor(message = "invalid role grant") {
    super(message);
  }
}

export class UserNotActiveError extends DomainError {
  readonly domainCode = "USER_NOT_ACTIVE";

  constructor(message = "user is not active") {
    super(message);
  }
}

export class UserNotFoundError extends DomainError {
  readonly domainCode = "USER_NOT_FOUND";

  constructor(message = "user not found") {
    super(message);
  }
}

export class RoleNotFoundError extends DomainError {
  readonly domainCode = "ROLE_NOT_FOUND";

  constructor(message = "role not found") {
    super(message);
  }
}

export class ForbiddenIdentityActionError extends DomainError {
  readonly domainCode = "FORBIDDEN_IDENTITY_ACTION";

  constructor(message = "forbidden identity action") {
    super(message);
  }
}
