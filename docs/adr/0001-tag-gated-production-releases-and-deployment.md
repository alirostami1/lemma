# ADR: Tag-Gated Production Releases and Deployment

## Status

Proposed

## Context

Lemma uses trunk-based development. `main` is the supported integration branch
and should stay releasable, but `main` is not the production deployment trigger.
CI continues to run on pull requests and pushes to `main`; the aggregate
required branch protection check remains `ci summary`.

Production deployment is an explicit release decision. Ordinary pushes to
`main` must not deploy production automatically.

## Decision

Production deploys run automatically only when a semantic-version release tag is
pushed. Release tags use `vMAJOR.MINOR.PATCH`, such as `v0.1.0`, `v0.2.1`, or
`v1.0.0`. Tags such as `release-1`, `v1`, `v1.2`, `latest`, and `prod` are not
valid release tags.

Before the first production launch, use `v0.x.y` release tags. Reserve
`v1.0.0` for the first real production release.

`workflow_dispatch` remains available for controlled manual deployment,
redeploy, and recovery.

Release checklist before tagging:

1. Confirm intended changes are merged to `main`.
2. Confirm `ci summary` is green on `main`.
3. Review deploy-risk, data-risk, and security notes for included changes.
4. Confirm production database changes are compatible with the deployed version.
5. Create and push an immutable release tag matching `vMAJOR.MINOR.PATCH`.

Release tags should be immutable. Rollback should normally happen by creating a
new corrective tag from the intended commit, not by force-moving an old tag.

Staging or preview environments may be added later, but production remains
tag-gated.

Production database changes should prefer expand/contract migrations:

1. Add backward-compatible schema.
2. Deploy code that works with old and new schema.
3. Remove old schema in a later deploy.

Destructive migrations need explicit deploy-risk notes.

## Consequences

`main` remains the integration branch and stays releasable without being an
automatic production trigger. Production deploys become auditable release events
backed by explicit release tags or manual dispatch.
