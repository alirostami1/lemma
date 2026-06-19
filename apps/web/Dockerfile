FROM docker.io/library/node:22-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/error/package.json packages/error/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/files/package.json packages/files/package.json
COPY packages/http/package.json packages/http/package.json
COPY packages/identity/package.json packages/identity/package.json
COPY packages/openapi-hono-generator/package.json packages/openapi-hono-generator/package.json
COPY packages/questions/package.json packages/questions/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/workbook/package.json packages/workbook/package.json
COPY packages/workbook-engine/package.json packages/workbook-engine/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG LEMMA_WEB_APP_TITLE
ARG LEMMA_WEB_APP_URL
ARG LEMMA_WEB_API_URL
ARG LEMMA_WEB_REALTIME_URL
ARG LEMMA_WEB_OIDC_ISSUER_URI
ARG LEMMA_WEB_OIDC_CLIENT_ID

ENV LEMMA_WEB_APP_TITLE=$LEMMA_WEB_APP_TITLE
ENV LEMMA_WEB_APP_URL=$LEMMA_WEB_APP_URL
ENV LEMMA_WEB_API_URL=$LEMMA_WEB_API_URL
ENV LEMMA_WEB_REALTIME_URL=$LEMMA_WEB_REALTIME_URL
ENV LEMMA_WEB_OIDC_ISSUER_URI=$LEMMA_WEB_OIDC_ISSUER_URI
ENV LEMMA_WEB_OIDC_CLIENT_ID=$LEMMA_WEB_OIDC_CLIENT_ID

COPY . .

RUN pnpm --filter web... build

FROM docker.io/library/node:22-alpine AS runtime

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="3000"

WORKDIR /repo/apps/web

COPY --from=build /repo/apps/web/.output ./.output
COPY --from=build /repo/apps/web/package.json ./package.json

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
