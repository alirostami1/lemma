# @lemma/questions

Question authoring, generation, grading, and question set bounded context.

## Main Surface

- question blueprint and question domain models
- generation and grading application services
- HTTP handlers and presenters
- OpenAPI fragment and generated route helpers

## Used By

- API app
- worker app
- web question authoring and generation flows
- workbook package for value resolution

## Commands

```bash
pnpm --filter @lemma/questions build
pnpm --filter @lemma/questions test
pnpm --filter @lemma/questions generate:hono
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
