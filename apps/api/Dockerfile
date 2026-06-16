FROM docker.io/library/node:22-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/error/package.json packages/error/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/files/package.json packages/files/package.json
COPY packages/http/package.json packages/http/package.json
COPY packages/identity/package.json packages/identity/package.json
COPY packages/notifications/package.json packages/notifications/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/ops/package.json packages/ops/package.json
COPY packages/openapi-hono-generator/package.json packages/openapi-hono-generator/package.json
COPY packages/questions/package.json packages/questions/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/workbook/package.json packages/workbook/package.json
COPY packages/workbook-engine/package.json packages/workbook-engine/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .

RUN pnpm --filter api... build

FROM docker.io/library/node:22-alpine AS runtime

ENV NODE_ENV="production"

WORKDIR /repo/apps/api

COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=deps /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=deps /repo/package.json /repo/package.json
COPY --from=deps /repo/pnpm-workspace.yaml /repo/pnpm-workspace.yaml
COPY --from=build /repo/packages/config/dist /repo/packages/config/dist
COPY --from=build /repo/packages/config/package.json /repo/packages/config/package.json
COPY --from=build /repo/packages/db/dist /repo/packages/db/dist
COPY --from=build /repo/packages/db/package.json /repo/packages/db/package.json
COPY --from=build /repo/packages/domain/dist /repo/packages/domain/dist
COPY --from=build /repo/packages/domain/package.json /repo/packages/domain/package.json
COPY --from=build /repo/packages/error/dist /repo/packages/error/dist
COPY --from=build /repo/packages/error/package.json /repo/packages/error/package.json
COPY --from=build /repo/packages/events/dist /repo/packages/events/dist
COPY --from=build /repo/packages/events/package.json /repo/packages/events/package.json
COPY --from=build /repo/packages/files/dist /repo/packages/files/dist
COPY --from=build /repo/packages/files/package.json /repo/packages/files/package.json
COPY --from=build /repo/packages/http/dist /repo/packages/http/dist
COPY --from=build /repo/packages/http/package.json /repo/packages/http/package.json
COPY --from=build /repo/packages/identity/dist /repo/packages/identity/dist
COPY --from=build /repo/packages/identity/package.json /repo/packages/identity/package.json
COPY --from=build /repo/packages/notifications/dist /repo/packages/notifications/dist
COPY --from=build /repo/packages/notifications/package.json /repo/packages/notifications/package.json
COPY --from=build /repo/packages/observability/dist /repo/packages/observability/dist
COPY --from=build /repo/packages/observability/package.json /repo/packages/observability/package.json
COPY --from=build /repo/packages/ops/dist /repo/packages/ops/dist
COPY --from=build /repo/packages/ops/package.json /repo/packages/ops/package.json
COPY --from=build /repo/packages/questions/dist /repo/packages/questions/dist
COPY --from=build /repo/packages/questions/package.json /repo/packages/questions/package.json
COPY --from=build /repo/packages/workbook/dist /repo/packages/workbook/dist
COPY --from=build /repo/packages/workbook/package.json /repo/packages/workbook/package.json
COPY --from=build /repo/packages/workbook-engine/dist /repo/packages/workbook-engine/dist
COPY --from=build /repo/packages/workbook-engine/package.json /repo/packages/workbook-engine/package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
