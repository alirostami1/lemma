# Development

## Workflow

1. Create or pick one issue for the logical change.
2. Create a branch from `origin/main`.
3. Keep changes scoped to the issue.
4. Update tests and docs when behavior changes.
5. Update generated files only by changing their source and running the generator.
6. Rebase on `origin/main` before opening a PR when practical.
7. Open a PR with the repository template.
8. Merge only after required validation passes and review concerns are resolved.

## Issues

Use one issue per logical change. Do not use one broad issue for unrelated code,
docs, infra, deployment, and cleanup work.

Issue titles use:

```text
<area>: <problem or outcome>
```

Examples:

```text
questions: publish drafts as immutable blueprint versions
docs: document repository workflow conventions
deploy: gate production deploys behind release tags
```

Good issues include:

* a clear problem or desired outcome;
* user, operator, contributor, or product impact when relevant;
* scope and out-of-scope sections;
* acceptance criteria;
* validation expectations;
* links to ADRs, design notes, logs, screenshots, or related PRs when useful;
* migration, deployment, API, data, or security risks when relevant.

Issue body sections should usually be:

```markdown
## Problem

## Desired outcome

## Scope

## Out of scope

## Acceptance criteria

## Validation

## Risk
```

Sensitive issues must follow `SECURITY.md`. Do not put credentials, exploit
details, customer data, or private logs in ordinary issues.

## Branches

Branches must be based on `origin/main` unless a stacked PR is explicitly
requested.

Branch names use:

```text
<type>/<issue-number>-<short-slug>
```

Examples:

```text
feat/112-blueprint-draft-publish
docs/123-repository-workflow-conventions
fix/57-caddy-cloudflare-proxy-module
```

Allowed branch types match commit types:

* `fix`
* `feat`
* `docs`
* `test`
* `refactor`
* `chore`
* `ci`
* `build`

Branch rules:

* keep the branch scoped to the issue;
* use lowercase slugs with hyphens;
* do not include unrelated refactors;
* for stacked PRs, call out the base PR in the PR body with
  `Depends on #<pr-number>`.

## Commits

Commit titles use Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

Allowed commit types:

* `fix`
* `feat`
* `docs`
* `test`
* `refactor`
* `chore`
* `ci`
* `build`

Common scopes:

* `repo`
* `docs`
* `web`
* `admin`
* `api`
* `worker`
* `db`
* `questions`
* `workbooks`
* `files`
* `identity`
* `events`
* `http`
* `ui`
* `deploy`
* `ansible`
* `ci`
* `build`

Good commit titles:

```text
feat(questions): publish drafts through versioned snapshots
fix(deploy): add caddy cloudflare proxy module
docs(repo): document repository workflow conventions
ci(deploy): gate production deploys behind release tags
build(openapi): regenerate questions contracts
```

Bad commit titles:

```text
fix
changes
update files
feat: stuff
final fixes
```

Commit rules:

* use an imperative summary;
* keep each commit reviewable;
* split commits by concern, not by every tiny file;
* do not leave `wip`, `temp`, or `fix lint` commits in final PR history;
* separate generated/tooling churn from feature logic when practical;
* explain non-obvious why-details in the commit body;
* do not manually edit generated files;
* do not manually edit lockfiles without an intentional dependency/tooling
  change;
* do not mix unrelated cleanup into feature commits.

## Pull Requests

PR titles use the same Conventional Commit format as commits:

```text
<type>(<scope>): <imperative summary>
```

Every PR body must include:

```text
Closes #<issue-number>
```

Use `Closes #...` for the main issue. Use `Refs #...` only for related issues
that the PR does not close.

PRs target `main` by default.

PR body sections must include:

```markdown
## Summary

## What changed

## Validation

## API changes

## Migration notes

## Generated files

## Changelog

## Risk

## Follow-up / out of scope
```

PR rules:

* keep the PR scoped to one issue;
* call out stacked PRs with `Depends on #<pr-number>`;
* include screenshots or recordings for UI changes;
* include API changes for route, request, response, schema, or generated-client
  changes;
* include migration notes for DB, data, deployment, infra, or secrets changes;
* include generated-file notes when OpenAPI, generated clients, DB types, or
  other generated artifacts change;
* include validation commands actually run;
* mention skipped validation honestly;
* include changelog notes for notable user-facing, API, migration, deployment, or
  developer-workflow changes;
* explicitly say when no changelog note is needed;
* do not hide unrelated refactors in a feature PR.

## Changelog Notes

This repository currently records changelog decisions in PR bodies instead of a
separate changelog file.

A PR should include a changelog note when it introduces notable:

* user-facing behavior;
* API changes;
* breaking changes;
* migrations;
* deployment or operations changes;
* security-relevant changes;
* developer-workflow changes.

A PR may mark changelog as not needed when it is only:

* test-only;
* internal refactor only;
* formatting only;
* dependency/tooling maintenance with no contributor impact;
* documentation-only with no process change.

Breaking changes must be called out clearly in both `API changes` or
`Migration notes` and `Changelog`.

## Generated Files And Lockfiles

Generated files must be changed by updating their source and running the correct
generator.

Examples:

* update OpenAPI source, then regenerate Hono/Zod/types;
* update DB migrations/source tables, then regenerate DB types if required;
* update generator code, then update generator snapshots.

Rules:

* never manually patch generated output to make tests pass;
* keep generated output in the same PR as its source change;
* separate broad generator/tooling churn from feature logic when practical;
* explain lockfile changes in the PR body;
* do not include lockfile changes for docs-only PRs unless tooling changed.

## Merge Readiness

A PR is merge-ready when:

* it is scoped to one issue;
* branch name matches `<type>/<issue-number>-<short-slug>`;
* PR title uses Conventional Commits;
* PR body includes `Closes #<issue-number>`;
* required PR template sections are filled;
* relevant validation passes;
* generated files are regenerated from source;
* docs are updated when behavior or workflow changes;
* API/migration/deploy/security risks are called out;
* changelog decision is explicit;
* unrelated refactors are removed or moved to another PR.

## Collaboration

* Keep discussion direct and technical.
* Record product or architecture decisions in issues, ADRs, or docs.
* Raise deploy risk, data risk, or security concerns before merge.
* Prefer long-term maintainable fixes over local patches.
* Do not sugarcoat known design problems.
* Keep unrelated refactors out of feature branches.

## Validation

Run before non-doc PRs:

```bash
pnpm check:types && pnpm check && pnpm test
```

For focused work, package filters are fine:

```bash
pnpm --filter @lemma/questions test
pnpm --filter @lemma/questions check:types
pnpm --filter web check:types
```

For docs-only changes, run:

```bash
pnpm check:docs
```

If a docs PR also changes workflow files, issue templates, or CI configuration, expect CI to run broader workflow validation.

## CI Scope

CI should stay change-scoped as the repo grows:

* docs-only changes run docs validation, not deploy;
* Dockerfile changes run hadolint and build checks for affected images;
* Ansible changes run ansible-lint and playbook syntax checks;
* workflow changes run actionlint;
* production Compose/Caddy/script changes run infra validation, not full app
  validation;
* app/package changes run TypeScript, lint, and tests for affected packages.

CI path groups live in `.github/path-filters/ci.yml`. The required branch
protection check should be `ci summary`; it stays green only when all relevant
jobs pass and treats intentionally skipped jobs as OK.

Docs validation currently runs markdownlint. Architecture validation runs
dependency-cruiser as an import graph baseline plus the repo-specific package
boundary checks as hard policy. Infra validation currently runs ShellCheck for
production shell scripts, yamllint for workflow/Ansible YAML, actionlint,
ansible-lint, and Ansible playbook syntax checks.

## Production Deploys

The production deploy workflow runs automatically only from semantic-version
release tags. It remains manually available through `workflow_dispatch`.
Ordinary pushes to `main` must not deploy production.

Release flow:

```text
feature branch -> PR -> main -> CI green -> release tag -> production deploy
```

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

Source-time Node/tsx scripts may use `--conditions=source` so workspace imports
resolve to source exports.

Browser Vite apps must not set global `resolve.conditions: ["source"]`.

Browser-safe workspace packages should expose browser-safe source through public
exports.

Runtime and server packages should keep runtime exports pointing to `dist/*`.

## Migrations

Prefer expand/contract migrations:

1. Add backward-compatible schema.
2. Deploy code that works with old and new schema.
3. Remove old schema in a later deploy.

Destructive migrations need explicit deploy-risk notes in the PR.

## Documentation

Package READMEs should stay short:

* purpose
* main exports
* dependencies
* used by
* commands
* generated files or gotchas
