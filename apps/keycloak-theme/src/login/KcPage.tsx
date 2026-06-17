import type { ClassKey } from "keycloakify/login";
import DefaultPage from "keycloakify/login/DefaultPage";
import Template from "keycloakify/login/Template";
import { lazy, Suspense } from "react";
import type { I18n } from "./i18n";
import { useI18n } from "./i18n";
import type { KcContext } from "./KcContext";
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
            return (
              <UpdatePasswordPage {...commonProps} kcContext={kcContext} />
            );
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
  kcContentWrapperClass: "space-y-1",
  kcFormGroupClass: "space-y-2",
  kcFormGroupHeader: "text-sm font-medium text-foreground",
  kcFormPasswordVisibilityButtonClass:
    "inline-flex h-8 shrink-0 items-center rounded-r-lg border border-l-0 border-input px-2.5 text-sm text-muted-foreground hover:bg-muted",
  kcInputClass:
    "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
  kcInputErrorMessageClass: "block text-sm text-destructive",
  kcInputGroup: "flex w-full",
  kcInputHelperTextAfterClass: "text-sm text-muted-foreground",
  kcInputHelperTextBeforeClass: "text-sm text-muted-foreground",
  kcInputWrapperClass: "space-y-1",
  kcLabelClass: "text-sm font-medium leading-none",
  kcLabelWrapperClass: "flex items-center gap-1",
} satisfies { [key in ClassKey]?: string };
