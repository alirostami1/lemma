import { createGetKcContextMock } from "keycloakify/login/KcContext";
import type { DeepPartial } from "keycloakify/tools/DeepPartial";

import { kcEnvDefaults } from "../kc.gen";
import type {
  KcContext,
  KcContextExtension,
  KcContextExtensionPerPage,
  PageId,
} from "./KcContext";
import KcPage from "./KcPage";

const kcContextExtension: KcContextExtension = {
  properties: { ...kcEnvDefaults },
  themeName: "lemma",
};

const kcContextExtensionPerPage: KcContextExtensionPerPage = {};

export const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension,
  kcContextExtensionPerPage,
  overrides: {},
  overridesPerPage: {},
});

export function createKcPageStory(params: { pageId: PageId }) {
  const { pageId } = params;

  function KcPageStory(props: { kcContext?: DeepPartial<KcContext> }) {
    const kcContextMock = getKcContextMock({
      overrides: props.kcContext as never,
      pageId,
    });

    return <KcPage kcContext={kcContextMock} />;
  }

  return { KcPageStory };
}
