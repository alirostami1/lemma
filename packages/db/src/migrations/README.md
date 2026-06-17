# Migration Conventions

Prefer expand/contract migrations:

- Add nullable columns, backfill, then tighten constraints in a later migration.
- Keep new schema compatible with the currently deployed application until the
  next release is live.
- Avoid destructive `up` migrations. Drops and irreversible rewrites need a
  rollout plan in the PR.
- Use `documentDestructiveChange` when a migration intentionally removes data or
  schema, including rollback paths. This makes risky operations easy to spot in
  review.
- Use shared helpers from `helpers.ts` for common migration types and safety
  markers.

After migration changes, regenerate `packages/db/src/types.d.ts` from a database
with current migrations applied.
