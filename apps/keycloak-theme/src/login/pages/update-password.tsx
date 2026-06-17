import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import { Label } from "@lemma/ui/components/label";
import type { KcContext } from "../KcContext";
import type { LemmaPageProps } from "../KcPage";
import { AuthLayout } from "./auth-layout";
import { FieldError } from "./field-error";

type UpdatePasswordContext = Extract<
  KcContext,
  { pageId: "login-update-password.ftl" }
>;

export function UpdatePasswordPage(
  props: LemmaPageProps<UpdatePasswordContext>,
) {
  const { kcContext, i18n } = props;
  const { messagesPerField, url } = kcContext;
  const { msg, msgStr } = i18n;
  const hasPasswordError = messagesPerField.existsError(
    "password",
    "password-confirm",
  );

  return (
    <AuthLayout
      title={msg("updatePasswordTitle")}
      description={msg("passwordNew")}
      message={
        hasPasswordError ? messagesPerField.getFirstError("password") : null
      }
    >
      <form action={url.loginAction} className="space-y-4" method="post">
        <div className="space-y-2">
          <Label htmlFor="password-new">{msg("passwordNew")}</Label>
          <Input
            aria-invalid={hasPasswordError}
            autoComplete="new-password"
            autoFocus
            id="password-new"
            name="password-new"
            type="password"
          />
          {messagesPerField.existsError("password") ? (
            <FieldError>{messagesPerField.get("password")}</FieldError>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password-confirm">{msg("passwordConfirm")}</Label>
          <Input
            aria-invalid={hasPasswordError}
            autoComplete="new-password"
            id="password-confirm"
            name="password-confirm"
            type="password"
          />
          {messagesPerField.existsError("password-confirm") ? (
            <FieldError>{messagesPerField.get("password-confirm")}</FieldError>
          ) : null}
        </div>
        <Button className="w-full" type="submit">
          {msgStr("doSubmit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
