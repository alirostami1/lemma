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
  themeName: "lemma",
  properties: { ...kcEnvDefaults },
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
      pageId,
      overrides: props.kcContext as never,
    });

    return <KcPage kcContext={kcContextMock} />;
  }

  return { KcPageStory };
}
