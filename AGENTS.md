# Agent Instructions

## Context Discipline

- Read only files needed for current task.
- Do not scan whole repo unless task requires it.
- Prefer `rg` with focused patterns over broad listing.
- Do not run `ls -R`, broad `find`, or broad `rg --files` at task start.
- Do not paste large file contents into responses.
- Summarize large outputs; include only relevant lines.
- Read docs only when directly relevant to the task.
- Reuse known context from current thread; do not re-read same file unless needed.

## Change Discipline

- Keep changes scoped to request.
- Do not refactor unrelated code.
- Do not change formatting-only unless requested.
- Do not manually edit generated files, lockfiles, or snapshots unless task specifically requires it.
- Do not import from another package's `src/*`.
- App is pre-release; breaking changes are allowed when they improve long-term design.

## GitHub Workflow Discipline

- Create or pick an issue before branch/PR work when asked to publish changes.
- Create branches from `origin/main` unless the user explicitly asks for a stacked PR.
- Branch names must include the issue number:
  `<type>/<issue-number>-<short-slug>`.
- Use Conventional Commits for commits and PR titles:
  `<type>(<scope>): <imperative summary>`.
- PRs target `main` by default and include `Closes #<issue-number>`.
- Only create stacked PRs when the user explicitly requests one; mark them with
  `Depends on #<pr-number>`.
- Keep unrelated changes out of the branch and stage only files in scope.
- If a pushed branch accidentally includes the wrong commit, create a corrected
  issue-numbered branch from `origin/main` rather than stacking by accident.

Common types: `fix`, `feat`, `chore`, `docs`, `test`, `refactor`, `ci`, `build`.
Common scopes: `web`, `admin`, `api`, `worker`, `db`, `keycloak`, `caddy`,
`files`, `deploy`, `ansible`, `ci`, `docs`.

## Validation

- Do not run validation unless explicitly asked.
- If validation is requested, use:
  `pnpm check-types && pnpm check && pnpm test`
- Prefer focused checks before full validation when debugging a failure.
- Report exact failing package/file/test if validation fails.
- When editing CI, keep validation and deploy workflows scoped to relevant paths
  so docs-only or unrelated changes do not run production deploys.

## Communication

- Be concise.
- Mention files changed and validation status.
- Do not include large code blocks unless asked.
- Ask only when product intent is ambiguous; discover repo facts by reading focused files.

  For even tighter context saving, add this:

## Hard Limits

- Always use caveman
- Max initial exploration: 3 targeted commands.
- Max file reads before first edit: only files directly involved.
- Do not inspect unrelated packages.
- Stop exploring once implementation path is clear.
