import { Button } from "@lemma/ui/components/button";
import type { KcContext } from "../KcContext";
import type { LemmaPageProps } from "../KcPage";
import { AuthLayout } from "./auth-layout";

type ErrorContext = Extract<KcContext, { pageId: "error.ftl" }>;

export function ErrorPage(props: LemmaPageProps<ErrorContext>) {
  const { kcContext, i18n } = props;
  const { msg, msgStr } = i18n;
  const { client, message } = kcContext;

  return (
    <AuthLayout
      title={message?.summary ?? msg("errorTitle")}
      description={msg("doTryAgain")}
    >
      {client?.baseUrl ? (
        <Button asChild className="w-full">
          <a href={client.baseUrl}>{msgStr("backToApplication")}</a>
        </Button>
      ) : null}
    </AuthLayout>
  );
}
