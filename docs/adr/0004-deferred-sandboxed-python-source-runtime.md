# ADR 0004: Deferred Sandboxed Python Source Runtime

## Status

Accepted.

References: #107, #102

## Context

The source lifecycle reserves `python` as a future source kind. Python source
revisions are inert content, but validating, materializing, or executing that
content crosses a security boundary. The API process is not an acceptable
Python runtime or sandbox.

## Decision

Python execution is deferred. There is no Python runtime feature flag, API
endpoint, queue handler, or production execution path in this phase. Draft
source intents remain workbook-only. The domain rejects every attempt to create
or reconstitute a Python source artifact, including artifacts marked pending,
valid, invalid, archived, or deleted.

Python revision metadata is exactly:

```text
schemaVersion: 1
encoding: utf-8
entrypoint: main.py
```

Python artifact metadata is exactly schema version 1 plus these closed objects:

```text
runtime: implementation, version, imageDigest, dependencyLockChecksumSha256
sandboxPolicy: cpuTimeLimitMs, memoryLimitBytes, wallClockTimeoutMs,
  filesystem, network
staticAnalysis: analyzer, analyzerVersion, passed
audit: eventSchemaVersion
```

Runtime and analyzer versions are exact version numbers, and the runtime image
is pinned by digest. The runtime implementation is `cpython`, filesystem mode
is `isolated`, network mode is `disabled`, and the audit event schema is 1.

Unknown fields are rejected rather than ignored at every metadata level. This
prevents metadata from carrying alternate paths, commands, environment values,
mounts, or policy overrides. Stored artifact metadata is descriptive only and
cannot relax server-owned sandbox policy.

## Required Worker Boundary

A follow-up implementation must run outside the API process in a dedicated
sandbox worker. Before any endpoint or feature flag can be enabled, the worker
must provide all of these controls:

- enforced CPU-time limit per job;
- enforced memory limit per job;
- enforced wall-clock timeout with termination and cleanup;
- an isolated ephemeral filesystem with only explicitly staged source and
  output paths, no host mounts, and no path traversal;
- no network namespace or outbound network access by default;
- an immutable runtime image pinned by digest, exact interpreter version, and
  dependency lock checksum recorded in artifact metadata;
- structured audit events for request, policy, runtime identity, start,
  completion or termination, resource-limit violations, and output artifact
  checksums, correlated to user, source revision, artifact, and job IDs;
- bounded input and output sizes, bounded process count, no privilege
  escalation, and cleanup that does not depend on guest code cooperating.

The worker must treat limits as server-owned policy. User input and stored
artifact metadata cannot increase limits, enable networking, add host mounts,
or select an unpinned runtime. Future workers must continue rejecting unknown
policy and runtime fields unless a new ADR explicitly changes the contract.

## Enablement Gate

The follow-up issue must add the worker, threat-model review, integration tests
for every resource boundary, and operational monitoring before introducing a
disabled-by-default server-side feature flag. The flag may expose only the
sandbox worker path. It must never switch execution into the API process or
bypass policy enforcement. Production enablement requires an explicit rollout
configuration after the security review.

## Consequences

The lifecycle can safely identify Python documents and revisions now, while
Python artifacts cannot be materialized or mistaken for executable state. A
future implementation has an explicit metadata contract and worker acceptance
gate, without leaving a dormant execution endpoint in production.
