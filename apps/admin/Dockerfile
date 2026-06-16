FROM docker.io/library/node:22-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG LEMMA_ADMIN_APP_TITLE
ARG LEMMA_ADMIN_APP_URL
ARG LEMMA_ADMIN_API_URL
ARG LEMMA_ADMIN_OIDC_ISSUER_URI
ARG LEMMA_ADMIN_OIDC_CLIENT_ID

ENV LEMMA_ADMIN_APP_TITLE=$LEMMA_ADMIN_APP_TITLE
ENV LEMMA_ADMIN_APP_URL=$LEMMA_ADMIN_APP_URL
ENV LEMMA_ADMIN_API_URL=$LEMMA_ADMIN_API_URL
ENV LEMMA_ADMIN_OIDC_ISSUER_URI=$LEMMA_ADMIN_OIDC_ISSUER_URI
ENV LEMMA_ADMIN_OIDC_CLIENT_ID=$LEMMA_ADMIN_OIDC_CLIENT_ID

COPY . .

RUN pnpm --filter admin... build

FROM docker.io/nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html

EXPOSE 8080
