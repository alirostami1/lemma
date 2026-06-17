import { Button } from "@lemma/ui/components/button";
import { useState } from "react";
import type { ReactElement } from "react";
import type { UserProfileFormFieldsProps } from "keycloakify/login/UserProfileFormFieldsProps";
import { getKcClsx } from "keycloakify/login/lib/kcClsx";
import type { LazyOrNot } from "keycloakify/tools/LazyOrNot";

import type { LemmaPageProps } from "../KcPage";
import type { KcContext } from "../KcContext";
import { AuthLayout } from "./auth-layout";

type RegisterContext = Extract<KcContext, { pageId: "register.ftl" }>;

type RegisterProps = LemmaPageProps<RegisterContext> & {
  UserProfileFormFields: LazyOrNot<
    (props: UserProfileFormFieldsProps) => ReactElement | null
  >;
  doMakeUserConfirmPassword: boolean;
};

export function RegisterPage(props: RegisterProps) {
  const { UserProfileFormFields, classes, doUseDefaultCss, kcContext, i18n } =
    props;
  const { msg, msgStr } = i18n;
  const { messagesPerField, url } = kcContext;
  const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });
  const [isFormSubmittable, setIsFormSubmittable] = useState(false);
  const hasFormError = messagesPerField.existsError(
    "firstName",
    "lastName",
    "email",
    "username",
    "password",
  );

  return (
    <AuthLayout
      title={msg("doRegister")}
      description={msg("registerTitle")}
      message={hasFormError ? messagesPerField.getFirstError("email") : null}
    >
      <form action={url.registrationAction} className="space-y-4" method="post">
        <div className="lemma-keycloak-profile-fields space-y-4">
          <UserProfileFormFields
            kcContext={kcContext}
            i18n={i18n}
            kcClsx={kcClsx}
            doMakeUserConfirmPassword={props.doMakeUserConfirmPassword}
            onIsFormSubmittableValueChange={setIsFormSubmittable}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <a
            className="text-sm font-medium text-primary hover:underline"
            href={url.loginUrl}
          >
            {msg("backToLogin")}
          </a>
          <Button disabled={!isFormSubmittable} type="submit">
            {msgStr("doRegister")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
