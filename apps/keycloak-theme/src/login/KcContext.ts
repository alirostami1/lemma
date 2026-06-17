import type { ExtendKcContext } from "keycloakify/login";

export type KcContextExtension = {
  themeName: "lemma";
  properties: Record<string, string | undefined>;
};

export type KcContextExtensionPerPage = Record<never, never>;

export type KcContext = ExtendKcContext<
  KcContextExtension,
  KcContextExtensionPerPage
>;

export type PageId = KcContext["pageId"];
