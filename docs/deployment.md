# Deployment

Production deployment is expected to build immutable images, run database
migrations deliberately, and roll application containers without interrupting
user traffic when possible.

## Deployment Flow

```mermaid
flowchart TD
  Merge[Merge or manual deploy] --> Build[Build Docker images]
  Build --> Push[Push immutable image tags]
  Push --> Pull[VPS pulls images]
  Pull --> Migrate[Run database migrations]
  Migrate --> Start[Start inactive app color]
  Start --> Health[Health checks]
  Health -->|pass| Switch[Switch reverse proxy traffic]
  Health -->|fail| Stop[Stop new color and keep old traffic]
  Switch --> Observe[Observe logs and metrics]
  Observe --> Cleanup[Clean old images later]
```

## Zero-Downtime Rules

- Keep app containers stateless.
- Use health checks before traffic switch.
- Keep migrations backward-compatible with the old and new app versions.
- Avoid running two active worker copies unless the job handlers are idempotent.
- Keep rollback realistic: schema changes may make rollback unsafe.

## Single-Node Limits

A single VPS can provide near-zero-downtime app releases, but not full high
availability. Host restarts, Docker daemon restarts, database restarts, and
stateful service upgrades still cause downtime.

## Future Production Shape

```mermaid
flowchart LR
  LB[Load balancer] --> AppA[App node A]
  LB --> AppB[App node B]
  AppA --> PG[(Managed Postgres)]
  AppB --> PG
  AppA --> S3[(Object storage)]
  AppB --> S3
  AppA --> Auth[Keycloak or managed auth]
  AppB --> Auth
```
