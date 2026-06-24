# @lemma/api-contract

Composes package OpenAPI fragments into API contracts and lints the result.

## Main Surface

- composed OpenAPI contract exports
- contract lint helpers

## Used By

- API docs
- web client generation
- CI contract checks

## Commands

```bash
pnpm --filter @lemma/api-contract lint
```

## Notes

Prefer fixing source package OpenAPI fragments over editing composed output.

This package is source-only and Node/tooling-only.
Import from `@lemma/api-contract/source` in Node/tooling contexts.
Browser apps should not import `@lemma/api-contract` directly.
