export class SignInRequiredRouteError extends Error {
  readonly reason = "sign_in_required";

  constructor() {
    super("Sign in is required.");
    this.name = "SignInRequiredRouteError";
  }
}

export class ForbiddenRouteError extends Error {
  readonly reason = "forbidden";
  readonly requiredRoles: string[] | undefined;

  constructor(requiredRoles?: string[]) {
    super("Access is forbidden.");
    this.name = "ForbiddenRouteError";
    this.requiredRoles = requiredRoles;
  }
}
