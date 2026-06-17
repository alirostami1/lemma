# Frontend Guidelines

These rules apply mainly to `apps/web`, `apps/admin`, and shared UI in
`packages/ui`.

## Dependency Direction

```text
routes
  -> features
    -> domains
      -> api wrappers
        -> generated API client
```

Rules:

- Routes should be thin.
- Features own UI workflows.
- Domains own app models, mappers, and business-facing API wrappers.
- Generated API types stay in API/domain adapter code.
- Shared visual primitives belong in `@lemma/ui`.

## Generated API Isolation

Do not import generated DTOs directly into route or feature components. Prefer:

```text
generated DTO -> domain mapper -> app model -> feature UI
```

This keeps UI stable when OpenAPI output changes.

## Component Structure

- Keep components mostly declarative.
- Move stateful workflow logic into controllers/hooks near the feature.
- Keep pure transforms in domain or feature helper files.
- Avoid prop drilling through many layers; create focused context only when it
  simplifies a real workflow.
- Effects should synchronize with external systems, not derive local state.

## State Rules

- Keep state close to where it is used.
- Do not duplicate derived state.
- Track dirty/pending/error states explicitly.
- Editor models should be JSON-compatible and serializable.
- Selection, hover, and focus state are UI state, not domain state.

## Type Rules

- Avoid `any`.
- Prefer discriminated unions for complex UI states.
- Use exhaustive checks for unions.
- Validate external data at boundaries.
- Prefer narrowing and helper predicates over assertions.

## UX Rules

- Use product language, not implementation language.
- Do not expose internal modes, IDs, or schema concepts in primary UI.
- Show only options that are meaningful for the current selection.
- Disabled states should have clear reasons when the reason is not obvious.
- Icon-only actions need accessible labels and useful tooltips.

## Error Handling

- Normalize API errors before they reach UI workflows.
- User-facing errors should explain what happened and what can be done.
- Developer details belong in logs or diagnostic panels, not primary copy.
- Do not swallow errors silently.

## Testing

- Test pure logic first.
- Add component tests for workflows with branching behavior.
- Add regression tests for bugs.
- Keep tests near the feature or domain they protect.

## Refactoring

- Keep refactors scoped.
- Do not mix unrelated refactors with feature work.
- Remove old code after replacement.
- Prefer moving code over rewriting behavior when splitting files.

## Review Checklist

- Are generated API types isolated?
- Are route components thin?
- Are business rules outside JSX?
- Are app/domain models distinct from transport DTOs?
- Are loading, empty, error, and disabled states handled?
- Are tests focused on the changed behavior?
