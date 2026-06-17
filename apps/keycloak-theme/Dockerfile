FROM docker.io/library/node:22-alpine AS theme-build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/keycloak-theme/package.json apps/keycloak-theme/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN pnpm install --frozen-lockfile

COPY apps/keycloak-theme apps/keycloak-theme
COPY packages/ui packages/ui
COPY packages/typescript-config packages/typescript-config

RUN pnpm --filter @lemma/ui build && pnpm --filter keycloak-theme build-keycloak-theme

FROM quay.io/keycloak/keycloak:26.6.2 AS keycloak-build

COPY --from=theme-build /repo/apps/keycloak-theme/dist_keycloak/lemma-keycloak-theme.jar /opt/keycloak/providers/lemma-keycloak-theme.jar

RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.6.2

COPY --from=keycloak-build /opt/keycloak/ /opt/keycloak/

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
