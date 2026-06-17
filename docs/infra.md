# Infrastructure

This document describes the local infrastructure stack and how the services fit
together. The stack is split by responsibility so app runtime, dependencies,
realtime, and observability can evolve independently.

The local stack targets Podman Compose. Make sure `podman compose` is available
on the machine before using the infra scripts.

## Compose Files

Use compose files together for the full local stack:

```bash
pnpm infra:up
```

Copy `infra/.env.example` to `infra/.env` first.

For normal application development, run only the shared infrastructure services
in Podman, then run the app processes with hot reload:

```bash
pnpm infra:dev
pnpm dev:env
```

`infra:dev` starts every compose service except `migrate`, `api`, `worker`, and
`web`. This keeps Postgres, Garage, Keycloak, LibreOffice worker, Centrifugo, and
observability available while Turbo runs app dev servers from source.
`dev:env` loads root `.env` into the child process environment without printing
or exporting values in the shell.

Files:

- `infra/compose-dev.yml`: Postgres, Garage object storage, and Garage CORS setup.
- `infra/compose-keycloak.yml`: Keycloak and its isolated Postgres database.
- `infra/compose-keycloak.prod.yml`: production-style Keycloak stack with the Lemma theme baked into the Keycloak image.
- `infra/compose-libreoffice-worker.yml`: internal workbook calculation service.
- `infra/compose-realtime.yml`: Centrifugo websocket and publish API.
- `infra/compose-observability.yml`: OpenTelemetry Collector, Jaeger, Prometheus, and Grafana.
- `infra/compose-apps.yml`: database migration job, API, async worker, and web app.

## Boot Order

1. Postgres starts and becomes healthy.
2. Garage starts and `garage-cors` applies bucket CORS for browser uploads.
3. Keycloak imports the Lemma realm.
4. LibreOffice worker, Centrifugo, and the observability stack start.
5. `migrate` runs Kysely migrations once.
6. API starts after migrations complete.
7. Async worker starts after migrations and dependency services.
8. Web starts after API is healthy.

## Runtime Flow

API handles HTTP requests and writes domain state to Postgres. Expensive work is
not run inline. Question generation requests create queued runs and outbox events.

Worker owns async execution:

- PgBoss stores queue state in the app Postgres database under its own schema.
- Outbox polling dispatches domain events to projectors or queues.
- Question generation jobs materialize questions and emit success/failure events.
- Failed question generation queue jobs are reconciled back to terminal run
  state after PgBoss retries are exhausted.
- Notification projector publishes realtime messages through Centrifugo.

Ops surfaces read failed outbox events and failed queue jobs from Postgres. Replay
actions move failed outbox events back to pending state.

## Ports

Defaults from `infra/.env.example`:

- Web: `3000`
- API: `3001`
- Centrifugo: `8000`
- Keycloak: `8001`
- Keycloak Postgres: `8002`
- Postgres: `5432`
- LibreOffice worker: `8080`
- Garage S3 API: `3900`
- OTel gRPC/HTTP: `4317`, `4318`
- Jaeger UI: `16686`
- Prometheus: `9090`
- Grafana: `3002`

## Observability

API and worker export OTLP traces and metrics to `otel-collector:4318`.
The worker also exports operational gauges for outbox counts, queue counts,
oldest pending ages, and recent question generation duration.

Application code should use `instrumentService(packageName, component)` for
internal work and `instrumentExternal(packageName, component)` for calls to
databases, queues, storage, identity providers, realtime services, and workbook
engines. Span names are `package.component.operation`. Metric labels stay
low-cardinality: `lemma_package`, `lemma_component`, `lemma_operation`, and
`status`. Request lineage belongs on spans through the `lineage` option, not on
metric labels.

The `Lemma Overview` dashboard only has Lemma application data when the worker
is running with `LEMMA_OTEL_ENABLED=true`. `pnpm infra:dev` starts Grafana,
Prometheus, and the collector, but does not start the worker. In source-dev
mode, run the worker through `pnpm dev:env` or start the full app stack with
`pnpm infra:up`.

Collector exports:

- traces to Jaeger
- metrics to Prometheus

Prometheus loads Lemma alert rules from `infra/prometheus/rules`. These cover
failed outbox events, unreconciled failed queue jobs, stale pending work, and
slow question generation.

Grafana provisions Prometheus automatically and loads `Lemma Overview` from
`infra/grafana/dashboards`.

Local URLs:

- Jaeger: `http://localhost:16686`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002`

## Environment

Use `infra/.env.example` as the source of truth for Podman Compose values.
Use app-level `.env.example` files for direct `pnpm dev` processes:

- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/worker/.env.example`

Deployment concerns live in [deployment.md](deployment.md). Keycloak theme image
details live in [apps/keycloak-theme/README.md](../apps/keycloak-theme/README.md).

## Data

Podman named volumes:

- `postgres-data`: app Postgres
- `postgres-data-keycloak`: Keycloak Postgres
- `garage-data`, `garage-meta`: object storage
- `prometheus-data`: metrics storage
- `grafana-data`: dashboard state

Removing these volumes deletes local state.

## Compose Config Check

Before starting the stack after infra edits, render Compose config:

```bash
pnpm infra:config
```
