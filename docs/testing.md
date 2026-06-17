# Testing

## Commands

Run full validation:

```bash
pnpm check-types && pnpm lint && pnpm test
```

Run focused tests with Turbo filters:

```bash
pnpm --filter @lemma/questions test
pnpm --filter web test
```

## Test Types

- package unit tests: domain and application behavior
- app tests: UI and controller behavior
- generated contract checks: OpenAPI and generated-file cleanliness
- architecture checks: package boundary rules

## Where To Add Tests

- Domain behavior: package `src/domain/*.test.ts`.
- Application orchestration: package `src/application/*.test.ts`.
- HTTP behavior: package `src/http` tests when handlers change.
- UI behavior: app feature or component tests near the feature.
- Code generation: generator package tests.

Keep tests close to the behavior they protect.
