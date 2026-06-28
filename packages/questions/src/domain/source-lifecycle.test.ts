import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "@lemma/domain";
import {
  createSourceArtifact,
  createSourceDocument,
  createSourceRevision,
  pythonSourceArtifactMetadata,
  reconstituteSourceArtifact,
  type SourceArtifactStatus,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  userId,
  workbookId,
} from "./index.js";

const at = new Date("2026-06-26T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df120001");
const documentId = sourceDocumentId("019e9315-6a87-715f-9861-8654df120002");
const revisionId = sourceRevisionId("019e9315-6a87-715f-9861-8654df120003");
const artifactId = sourceArtifactId("019e9315-6a87-715f-9861-8654df120004");
const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df120005");

test("creates workbook source document revision and valid artifact", () => {
  const document = createSourceDocument(
    {
      id: documentId,
      kind: "workbook",
      name: "Rates workbook",
      ownerUserId,
    },
    at,
  );
  const revision = createSourceRevision({
    byteSize: 1234,
    checksumSha256: "a".repeat(64),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    createdAt: at,
    createdByUserId: ownerUserId,
    editorMetadata: {},
    fileId: "019e9315-6a87-715f-9861-8654df120006",
    id: revisionId,
    kind: "workbook",
    ownerUserId,
    parentRevisionId: null,
    sourceDocumentId: document.id,
  });
  const artifact = createSourceArtifact(
    {
      artifactMetadata: {},
      id: artifactId,
      kind: "workbook",
      ownerUserId,
      processor: "lemma-workbook",
      processorVersion: "1",
      sourceRevisionId: revision.id,
      status: "valid",
      validationError: null,
      workbookId: sourceWorkbookId,
    },
    at,
  );

  assert.equal(document.status, "active");
  assert.equal(revision.sourceDocumentId, document.id);
  assert.equal(artifact.status, "valid");
  assert.equal(artifact.workbookId, sourceWorkbookId);
});

test("rejects valid workbook artifact without workbook", () => {
  assert.throws(
    () =>
      createSourceArtifact(
        {
          artifactMetadata: {},
          id: artifactId,
          kind: "workbook",
          ownerUserId,
          processor: "lemma-workbook",
          processorVersion: "1",
          sourceRevisionId: revisionId,
          status: "valid",
          validationError: null,
          workbookId: null,
        },
        at,
      ),
    /valid workbook source artifact must reference a workbook/,
  );
});

test("rejects reconstituted valid workbook artifact without workbook", () => {
  assert.throws(
    () =>
      reconstituteSourceArtifact({
        artifactMetadata: {},
        createdAt: at,
        id: artifactId,
        kind: "workbook",
        ownerUserId,
        processor: "lemma-workbook",
        processorVersion: "1",
        sourceRevisionId: revisionId,
        status: "valid",
        updatedAt: at,
        validationError: null,
        workbookId: null,
      }),
    /valid workbook source artifact must reference a workbook/,
  );
});

test("rejects malformed Python artifact creation with disabled materialization error", () => {
  assert.throws(
    () =>
      createSourceArtifact(
        {
          artifactMetadata: {},
          id: artifactId,
          kind: "python",
          ownerUserId,
          processor: "lemma-python",
          processorVersion: "1",
          sourceRevisionId: revisionId,
          status: "invalid",
          validationError: {},
          workbookId: sourceWorkbookId,
        },
        at,
      ),
    /python source artifact materialization is disabled/,
  );
});

test("rejects malformed Python artifact reconstitution with disabled materialization error", () => {
  assert.throws(
    () =>
      reconstituteSourceArtifact({
        artifactMetadata: {},
        createdAt: at,
        id: artifactId,
        kind: "python",
        ownerUserId,
        processor: "lemma-python",
        processorVersion: "1",
        sourceRevisionId: revisionId,
        status: "invalid",
        updatedAt: at,
        validationError: {},
        workbookId: sourceWorkbookId,
      }),
    /python source artifact materialization is disabled/,
  );
});

test("reserves Python revisions with fixed single-file metadata", () => {
  const revision = createPythonRevision();

  assert.equal(revision.kind, "python");
  assert.deepEqual(revision.editorMetadata, {
    encoding: "utf-8",
    entrypoint: "main.py",
    schemaVersion: 1,
  });
});

test("rejects Python revision entrypoint paths", () => {
  assert.throws(
    () =>
      createPythonRevision({
        editorMetadata: pythonRevisionMetadata({
          entrypoint: "../../main.py",
        }),
      }),
    /must use schema version 1, UTF-8, and main\.py/,
  );
});

for (const field of ["path", "files"] as const) {
  test(`rejects Python revision metadata with extra ${field} field`, () => {
    assert.throws(
      () =>
        createPythonRevision({
          editorMetadata: pythonRevisionMetadata({
            [field]: field === "path" ? "../../main.py" : ["main.py"],
          }),
        }),
      /python source revision metadata must use schema version 1, UTF-8, and main\.py/,
    );
  });
}

for (const contentType of [
  "application/octet-stream",
  "text/plain",
  "text/x-python",
  "text/x-python; charset=latin1",
  " text/x-python; charset=utf-8 ",
]) {
  test(`rejects Python revision content type ${contentType}`, () => {
    assert.throws(
      () => createPythonRevision({ contentType }),
      /python source revision contentType must be text\/x-python; charset=utf-8/,
    );
  });
}

test("defines deterministic Python worker artifact metadata", () => {
  const metadata = pythonSourceArtifactMetadata(pythonArtifactMetadata());

  assert.equal(metadata.runtime.implementation, "cpython");
  assert.equal(metadata.sandboxPolicy.network, "disabled");
});

test("rejects Python artifact metadata that enables network access", () => {
  const metadata = pythonArtifactMetadata();
  assert.throws(
    () =>
      pythonSourceArtifactMetadata({
        ...metadata,
        sandboxPolicy: { ...metadata.sandboxPolicy, network: "enabled" },
      }),
    /python source artifact metadata is invalid/,
  );
});

const artifactMetadataWithInvalidPrimitive = [
  [
    "runtime implementation",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        runtime: { ...metadata.runtime, implementation: "pypy" },
      };
    },
  ],
  [
    "runtime image digest",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        runtime: { ...metadata.runtime, imageDigest: "sha256:abc" },
      };
    },
  ],
  [
    "runtime dependency lock checksum",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        runtime: {
          ...metadata.runtime,
          dependencyLockChecksumSha256: "abc",
        },
      };
    },
  ],
  [
    "sandbox filesystem",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        sandboxPolicy: { ...metadata.sandboxPolicy, filesystem: "shared" },
      };
    },
  ],
  [
    "audit event schema version",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        audit: { ...metadata.audit, eventSchemaVersion: 2 },
      };
    },
  ],
  [
    "static analysis passed",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        staticAnalysis: { ...metadata.staticAnalysis, passed: "yes" },
      };
    },
  ],
] as const;

for (const [field, metadata] of artifactMetadataWithInvalidPrimitive) {
  test(`rejects Python artifact metadata with invalid ${field}`, () => {
    assert.throws(
      () => pythonSourceArtifactMetadata(metadata()),
      /python source artifact metadata is invalid/,
    );
  });
}

for (const field of [
  "cpuTimeLimitMs",
  "memoryLimitBytes",
  "wallClockTimeoutMs",
] as const) {
  for (const value of [0, -1, 1.5]) {
    test(`rejects Python artifact metadata with ${field} ${value}`, () => {
      const metadata = pythonArtifactMetadata();
      assert.throws(
        () =>
          pythonSourceArtifactMetadata({
            ...metadata,
            sandboxPolicy: { ...metadata.sandboxPolicy, [field]: value },
          }),
        /python source artifact metadata is invalid/,
      );
    });
  }
}

const artifactMetadataWithExtraField = [
  [
    "root policyOverride",
    () => ({ ...pythonArtifactMetadata(), policyOverride: {} }),
  ],
  ["root command", () => ({ ...pythonArtifactMetadata(), command: "python" })],
  [
    "runtime tag",
    () => {
      const metadata = pythonArtifactMetadata();
      return { ...metadata, runtime: { ...metadata.runtime, tag: "latest" } };
    },
  ],
  [
    "runtime command",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        runtime: { ...metadata.runtime, command: "python" },
      };
    },
  ],
  [
    "runtime env",
    () => {
      const metadata = pythonArtifactMetadata();
      return { ...metadata, runtime: { ...metadata.runtime, env: {} } };
    },
  ],
  [
    "sandbox mounts",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        sandboxPolicy: { ...metadata.sandboxPolicy, mounts: ["/host"] },
      };
    },
  ],
  [
    "sandbox networkPolicy",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        sandboxPolicy: {
          ...metadata.sandboxPolicy,
          networkPolicy: "allow",
        },
      };
    },
  ],
  [
    "sandbox allowNetwork",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        sandboxPolicy: { ...metadata.sandboxPolicy, allowNetwork: true },
      };
    },
  ],
  [
    "audit extra",
    () => {
      const metadata = pythonArtifactMetadata();
      return { ...metadata, audit: { ...metadata.audit, extra: true } };
    },
  ],
  [
    "static analysis ruleset",
    () => {
      const metadata = pythonArtifactMetadata();
      return {
        ...metadata,
        staticAnalysis: { ...metadata.staticAnalysis, ruleset: "relaxed" },
      };
    },
  ],
] as const;

for (const [field, metadata] of artifactMetadataWithExtraField) {
  test(`rejects Python artifact metadata with extra ${field} field`, () => {
    assert.throws(
      () => pythonSourceArtifactMetadata(metadata()),
      /python source artifact metadata is invalid/,
    );
  });
}

for (const version of ["latest", "3.13", " 3.13.5 "]) {
  test(`rejects Python runtime version ${JSON.stringify(version)}`, () => {
    const metadata = pythonArtifactMetadata();
    assert.throws(
      () =>
        pythonSourceArtifactMetadata({
          ...metadata,
          runtime: { ...metadata.runtime, version },
        }),
      /python source artifact metadata is invalid/,
    );
  });
}

for (const analyzerVersion of ["latest", "0.12"]) {
  test(`rejects analyzer version ${analyzerVersion}`, () => {
    const metadata = pythonArtifactMetadata();
    assert.throws(
      () =>
        pythonSourceArtifactMetadata({
          ...metadata,
          staticAnalysis: { ...metadata.staticAnalysis, analyzerVersion },
        }),
      /python source artifact metadata is invalid/,
    );
  });
}

for (const analyzer of ["", "   "]) {
  test(`rejects Python static analyzer name ${JSON.stringify(analyzer)}`, () => {
    const metadata = pythonArtifactMetadata();
    assert.throws(
      () =>
        pythonSourceArtifactMetadata({
          ...metadata,
          staticAnalysis: { ...metadata.staticAnalysis, analyzer },
        }),
      /python source artifact metadata is invalid/,
    );
  });
}

const sourceArtifactStatuses: readonly SourceArtifactStatus[] = [
  "pending_validation",
  "valid",
  "invalid",
  "archived",
  "deleted",
];

for (const status of sourceArtifactStatuses) {
  test(`rejects creating ${status} Python artifact`, () => {
    assert.throws(
      () => createSourceArtifact(pythonArtifact(status), at),
      /python source artifact materialization is disabled/,
    );
  });

  test(`rejects reconstituting ${status} Python artifact`, () => {
    assert.throws(
      () =>
        reconstituteSourceArtifact({
          ...pythonArtifact(status),
          createdAt: at,
          updatedAt: at,
        }),
      /python source artifact materialization is disabled/,
    );
  });
}

function createPythonRevision(
  overrides: { contentType?: string; editorMetadata?: JsonObject } = {},
) {
  return createSourceRevision({
    byteSize: 42,
    checksumSha256: "b".repeat(64),
    contentType: overrides.contentType ?? "text/x-python; charset=utf-8",
    createdAt: at,
    createdByUserId: ownerUserId,
    editorMetadata: overrides.editorMetadata ?? pythonRevisionMetadata(),
    fileId: null,
    id: revisionId,
    kind: "python",
    ownerUserId,
    parentRevisionId: null,
    sourceDocumentId: documentId,
  });
}

function pythonRevisionMetadata(extra: JsonObject = {}): JsonObject {
  return {
    encoding: "utf-8",
    entrypoint: "main.py",
    schemaVersion: 1,
    ...extra,
  };
}

function pythonArtifactMetadata() {
  return {
    audit: { eventSchemaVersion: 1 },
    runtime: {
      dependencyLockChecksumSha256: null,
      imageDigest: `sha256:${"c".repeat(64)}`,
      implementation: "cpython",
      version: "3.13.5",
    },
    sandboxPolicy: {
      cpuTimeLimitMs: 1_000,
      filesystem: "isolated",
      memoryLimitBytes: 134_217_728,
      network: "disabled",
      wallClockTimeoutMs: 5_000,
    },
    schemaVersion: 1,
    staticAnalysis: {
      analyzer: "ruff",
      analyzerVersion: "0.12.0",
      passed: true,
    },
  };
}

function pythonArtifact(status: SourceArtifactStatus) {
  return {
    artifactMetadata: {},
    id: artifactId,
    kind: "python" as const,
    ownerUserId,
    processor: "lemma-python",
    processorVersion: "1",
    sourceRevisionId: revisionId,
    status,
    validationError: status === "invalid" ? {} : null,
    workbookId: null,
  };
}
