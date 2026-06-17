# Development

## Workflow

1. Create or pick an issue.
2. Create a branch from `origin/main`.
3. Keep changes scoped to the issue.
4. Update tests and docs when behavior changes.
5. Rebase on `origin/main` before opening a PR when practical.
6. Open a PR with the repository template.

## Collaboration

- Keep discussion direct and technical.
- Record product or architecture decisions in issues or docs.
- Raise deploy risk, data risk, or security concerns before merge.
- Keep unrelated refactors out of feature branches.

## Validation

Run before PR:

```bash
pnpm check-types && pnpm lint && pnpm test
```

For focused work, package filters are fine:

```bash
pnpm --filter @lemma/questions test
pnpm --filter web check-types
```

## Generated Files

Generated-output rules and commands live in
[docs/generated-files.md](docs/generated-files.md).

## Package Boundaries

Packages must use public exports. Do not import from another package's `src/*`.
The architecture check enforces this.

## Migrations

Prefer expand/contract migrations:

1. Add backward-compatible schema.
2. Deploy code that works with old and new schema.
3. Remove old schema in a later deploy.

Destructive migrations need explicit deploy-risk notes in the PR.

## Documentation

Package READMEs should stay short:

- purpose
- main exports
- dependencies
- used by
- commands
- generated files or gotchas
