import { i18nBuilder } from "keycloakify/login";

export const { useI18n, ofTypeI18n } = i18nBuilder
  .withThemeName<"lemma">()
  .build();

export type I18n = NonNullable<ReturnType<typeof useI18n>["i18n"]>;
