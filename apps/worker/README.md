# Worker app

Background runtime for asynchronous jobs, outbox dispatch, question generation,
workbook validation, workbook calculation, and failed queue reconciliation.

## Uses

- `@lemma/jobs` for queue dispatch
- `@lemma/events` for outbox processing
- `@lemma/questions` and `@lemma/workbook` for domain work

## Commands

```bash
pnpm --filter worker dev
pnpm --filter worker build
pnpm --filter worker test
pnpm --filter worker check:types
```

## Notes

Workers must be safe to restart. Be careful with concurrency and idempotency
when adding background handlers.
