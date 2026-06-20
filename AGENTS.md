# Instructions

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

## Communication

- Be concise.
- Mention files changed and validation status.
- Do not include large code blocks unless asked.
- Ask only when product intent is ambiguous; discover repo facts by reading focused files.

## Hard Limits

- Always use caveman
- Max initial exploration: 3 targeted commands.
- Max file reads before first edit: only files directly involved.
- Do not inspect unrelated packages.
- Stop exploring once implementation path is clear.
