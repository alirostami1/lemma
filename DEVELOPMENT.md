# Development

## Workflow

1. Create or pick an issue.
2. Create a branch from `origin/main`.
3. Keep changes scoped to the issue.
4. Update tests and docs when behavior changes.
5. Rebase on `origin/main` before opening a PR when practical.
6. Open a PR with the repository template.

## Issue, Branch, Commit, And PR Names

Use one issue per logical change. Branches must be based on `origin/main` unless
a stacked PR is explicitly requested.

Issue titles use:

```text
<area>: <problem or outcome>
```

Branches use:

```text
<type>/<issue-number>-<short-slug>
```

PR titles and commit titles use Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

Allowed types:

- `fix`
- `feat`
- `chore`
- `docs`
- `test`
- `refactor`
- `ci`
- `build`

Common scopes:

- `web`
- `admin`
- `api`
- `worker`
- `db`
- `keycloak`
- `caddy`
- `files`
- `deploy`
- `ansible`
- `ci`
- `docs`

PRs target `main` by default and include `Closes #<issue-number>`. Stacked PRs
must be explicitly called out in the PR body with `Depends on #<pr-number>`.
CI enforces branch names, PR titles, and issue links on pull requests.

Examples:

```text
Issue: deploy: Caddy cannot parse Cloudflare trusted proxy source
Branch: fix/57-caddy-cloudflare-proxy-module
Commit: fix(deploy): add caddy cloudflare proxy module
PR: fix(deploy): add caddy cloudflare proxy module
```

## Collaboration

- Keep discussion direct and technical.
- Record product or architecture decisions in issues or docs.
- Raise deploy risk, data risk, or security concerns before merge.
- Keep unrelated refactors out of feature branches.

## Validation

Run before PR:

```bash
pnpm check-types && pnpm check && pnpm test
```

For focused work, package filters are fine:

```bash
pnpm --filter @lemma/questions test
pnpm --filter web check-types
```

CI should stay change-scoped as the repo grows:

- docs-only changes run docs validation, not deploy.
- Dockerfile changes run Dockerfile lint/build checks for affected images.
- Ansible changes run playbook syntax checks and can add stricter lint checks
  as the role set stabilizes.
- production Compose/Caddy/script changes run infra validation.
- app/package changes run TypeScript, lint, and tests for affected packages.

CI path groups live in `.github/path-filters/ci.yml`. The required branch
protection check should be `ci summary`; it stays green only when all relevant
jobs pass and treats intentionally skipped jobs as OK.
Infra validation currently runs ShellCheck for production shell scripts,
yamllint for workflow/Ansible YAML, and Ansible playbook syntax checks.

The production deploy workflow should run automatically only when deployable
paths change. It must always remain available through `workflow_dispatch`.
The deploy job prints a non-secret deploy plan before changing the VPS.
After Ansible deploys, CI runs `scripts/production/smoke.sh` against the
decrypted production env to verify public web, admin, API health, and OIDC
discovery endpoints through Caddy.

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
