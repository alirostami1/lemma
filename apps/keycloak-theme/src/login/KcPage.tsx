import { Suspense, lazy } from "react";
import type { ClassKey } from "keycloakify/login";
import DefaultPage from "keycloakify/login/DefaultPage";
import Template from "keycloakify/login/Template";

import type { KcContext } from "./KcContext";
import type { I18n } from "./i18n";
import { useI18n } from "./i18n";
import { ErrorPage } from "./pages/error";
import { InfoPage } from "./pages/info";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { ResetPasswordPage } from "./pages/reset-password";
import { UpdatePasswordPage } from "./pages/update-password";

const UserProfileFormFields = lazy(
  () => import("keycloakify/login/UserProfileFormFields"),
);

const doMakeUserConfirmPassword = true;

export default function KcPage(props: { kcContext: KcContext }) {
  const { kcContext } = props;
  const { i18n } = useI18n({ kcContext });

  if (i18n === null) {
    return null;
  }

  const commonProps = {
    i18n,
    doUseDefaultCss: false,
    Template,
    classes,
  };

  return (
    <Suspense fallback={null}>
      {(() => {
        switch (kcContext.pageId) {
          case "login.ftl":
            return <LoginPage {...commonProps} kcContext={kcContext} />;
          case "register.ftl":
            return (
              <RegisterPage
                {...commonProps}
                kcContext={kcContext}
                UserProfileFormFields={UserProfileFormFields}
                doMakeUserConfirmPassword={doMakeUserConfirmPassword}
              />
            );
          case "login-reset-password.ftl":
            return <ResetPasswordPage {...commonProps} kcContext={kcContext} />;
          case "login-update-password.ftl":
            return <UpdatePasswordPage {...commonProps} kcContext={kcContext} />;
          case "info.ftl":
            return <InfoPage {...commonProps} kcContext={kcContext} />;
          case "error.ftl":
            return <ErrorPage {...commonProps} kcContext={kcContext} />;
          default:
            return (
              <DefaultPage
                {...commonProps}
                kcContext={kcContext}
                UserProfileFormFields={UserProfileFormFields}
                doMakeUserConfirmPassword={doMakeUserConfirmPassword}
              />
            );
        }
      })()}
    </Suspense>
  );
}

export type LemmaPageProps<T extends KcContext = KcContext> = {
  kcContext: T;
  i18n: I18n;
  doUseDefaultCss: boolean;
  Template: typeof Template;
  classes: typeof classes;
};

const classes = {
  kcBodyClass: "bg-background text-foreground",
  kcButtonClass: "h-8 rounded-lg px-2.5 text-sm font-medium",
  kcButtonPrimaryClass: "bg-primary text-primary-foreground",
  kcInputClass: "h-8 rounded-lg border border-input px-2.5 text-sm",
  kcLabelClass: "text-sm font-medium",
} satisfies { [key in ClassKey]?: string };
