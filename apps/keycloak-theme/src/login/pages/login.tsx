import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import { Label } from "@lemma/ui/components/label";
import type { KcContext } from "../KcContext";
import type { LemmaPageProps } from "../KcPage";
import { AuthLayout } from "./auth-layout";

type LoginContext = Extract<KcContext, { pageId: "login.ftl" }>;

export function LoginPage(props: LemmaPageProps<LoginContext>) {
  const { kcContext, i18n } = props;
  const {
    auth,
    login,
    messagesPerField,
    realm,
    registrationDisabled,
    social,
    url,
    usernameHidden,
  } = kcContext;
  const { msg, msgStr } = i18n;
  const hasLoginError = messagesPerField.existsError("username", "password");

  return (
    <AuthLayout
      title={msg("doLogIn")}
      description={realm.registrationAllowed ? msg("noAccount") : undefined}
      message={
        hasLoginError ? messagesPerField.getFirstError("username") : null
      }
    >
      {realm.password ? (
        <form action={url.loginAction} className="space-y-4" method="post">
          {!usernameHidden ? (
            <div className="space-y-2">
              <Label htmlFor="username">
                {!realm.loginWithEmailAllowed
                  ? msg("username")
                  : !realm.registrationEmailAsUsername
                    ? msg("usernameOrEmail")
                    : msg("email")}
              </Label>
              <Input
                aria-invalid={hasLoginError}
                autoComplete="username"
                autoFocus
                defaultValue={login.username ?? ""}
                id="username"
                name="username"
                type="text"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="password">{msg("password")}</Label>
            <Input
              aria-invalid={hasLoginError}
              autoComplete="current-password"
              id="password"
              name="password"
              type="password"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            {realm.rememberMe && !usernameHidden ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  defaultChecked={Boolean(login.rememberMe)}
                  name="rememberMe"
                  type="checkbox"
                />
                {msg("rememberMe")}
              </label>
            ) : (
              <span />
            )}
            {realm.resetPasswordAllowed ? (
              <a
                className="text-sm font-medium text-primary hover:underline"
                href={url.loginResetCredentialsUrl}
              >
                {msg("doForgotPassword")}
              </a>
            ) : null}
          </div>

          <input
            name="credentialId"
            type="hidden"
            value={auth.selectedCredential}
          />
          <Button className="w-full" name="login" type="submit">
            {msgStr("doLogIn")}
          </Button>
        </form>
      ) : null}

      {realm.registrationAllowed && !registrationDisabled ? (
        <div className="text-center text-sm text-muted-foreground">
          {msg("noAccount")}{" "}
          <a
            className="font-medium text-primary hover:underline"
            href={url.registrationUrl}
          >
            {msg("doRegister")}
          </a>
        </div>
      ) : null}

      {social?.providers?.length ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-center text-sm text-muted-foreground">
            {msg("identity-provider-login-label")}
          </p>
          <div className="grid gap-2">
            {social.providers.map((provider) => (
              <Button asChild key={provider.alias} variant="outline">
                <a href={provider.loginUrl}>{provider.displayName}</a>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </AuthLayout>
  );
}
