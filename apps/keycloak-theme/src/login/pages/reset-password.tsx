import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import { Label } from "@lemma/ui/components/label";
import type { KcContext } from "../KcContext";
import type { LemmaPageProps } from "../KcPage";
import { AuthLayout } from "./auth-layout";

type ResetPasswordContext = Extract<
  KcContext,
  { pageId: "login-reset-password.ftl" }
>;

export function ResetPasswordPage(props: LemmaPageProps<ResetPasswordContext>) {
  const { kcContext, i18n } = props;
  const { auth, messagesPerField, realm, url } = kcContext;
  const { msg, msgStr } = i18n;
  const hasError = messagesPerField.existsError("username");

  return (
    <AuthLayout
      title={msg("emailForgotTitle")}
      description={msg("emailInstruction")}
      message={hasError ? messagesPerField.getFirstError("username") : null}
    >
      <form
        action={url.loginResetCredentialsUrl}
        className="space-y-4"
        method="post"
      >
        <div className="space-y-2">
          <Label htmlFor="username">
            {!realm.loginWithEmailAllowed
              ? msg("username")
              : realm.duplicateEmailsAllowed
                ? msg("usernameOrEmail")
                : msg("email")}
          </Label>
          <Input
            aria-invalid={hasError}
            autoComplete="username"
            autoFocus
            defaultValue={auth?.attemptedUsername ?? ""}
            id="username"
            name="username"
            type="text"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <a
            className="text-sm font-medium text-primary hover:underline"
            href={url.loginUrl}
          >
            {msg("backToLogin")}
          </a>
          <Button type="submit">{msgStr("doSubmit")}</Button>
        </div>
      </form>
    </AuthLayout>
  );
}
