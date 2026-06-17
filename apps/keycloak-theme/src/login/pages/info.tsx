import { Button } from "@lemma/ui/components/button";

import type { LemmaPageProps } from "../KcPage";
import type { KcContext } from "../KcContext";
import { AuthLayout } from "./auth-layout";

type InfoContext = Extract<KcContext, { pageId: "info.ftl" }>;

export function InfoPage(props: LemmaPageProps<InfoContext>) {
  const { kcContext, i18n } = props;
  const { msg, msgStr } = i18n;
  const { actionUri, client, message, pageRedirectUri } = kcContext;
  const href = actionUri ?? pageRedirectUri ?? client?.baseUrl;

  return (
    <AuthLayout title={message?.summary ?? msg("doContinue")}>
      {href ? (
        <Button asChild className="w-full">
          <a href={href}>{msgStr("proceedWithAction")}</a>
        </Button>
      ) : null}
    </AuthLayout>
  );
}
