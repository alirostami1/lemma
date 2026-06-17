# @lemma/db

Database package for Kysely types, migrations, and seed scripts.

## Main Surface

- migration runner
- generated Kysely database types
- development seed script

## Used By

- API app
- worker app
- bounded-context repositories

## Commands

```bash
pnpm --filter @lemma/db build
pnpm --filter @lemma/db generate
pnpm db:migrate:env
pnpm db:seed:dev
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
