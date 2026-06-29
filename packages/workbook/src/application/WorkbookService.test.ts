import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rootOperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import { eventId } from "@lemma/events/domain";
import { FileAliasUnavailableError } from "@lemma/files/application";
import type { CurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createWorkbook,
  type FileId,
  fileId,
  userId,
  type Workbook,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "../domain/index.js";
import { WorkbookFileUnavailableError } from "./errors.js";
import type {
  FileReferenceGuardPort,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import { WorkbookService } from "./WorkbookService.js";

const at = new Date("2026-06-28T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df160001");
const targetFileId = fileId("019e9315-6a87-715f-9861-8654df160002");
const targetWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df160003");

describe("WorkbookService file reference guard", () => {
  it("creates standalone workbooks when the file guard allows the alias", async () => {
    const repository = new FakeWorkbookRepository();
    const service = createService({
      repository,
      guard: { async assertFileAliasReferenceableForUpdate() {} },
    });

    const result = await service.createWorkbook(command());

    assert.equal(result.workbook.id, targetWorkbookId);
    assert.equal(result.workbook.origin, "standalone");
    assert.equal(repository.createdWorkbooks.length, 1);
  });

  it("reuses existing standalone workbooks only after the file guard allows the alias", async () => {
    const repository = new FakeWorkbookRepository();
    repository.existingWorkbook = workbookWith({
      origin: "standalone",
      status: "valid",
    });
    let guardCalls = 0;
    const service = createService({
      repository,
      guard: {
        async assertFileAliasReferenceableForUpdate() {
          guardCalls += 1;
        },
      },
    });

    const result = await service.createWorkbook(command());

    assert.equal(guardCalls, 1);
    assert.equal(result.workbook, repository.existingWorkbook);
    assert.equal(repository.createdWorkbooks.length, 0);
  });

  it("does not return an existing workbook when the file alias is unavailable", async () => {
    const repository = new FakeWorkbookRepository();
    repository.existingWorkbook = workbookWith({
      origin: "standalone",
      status: "valid",
    });
    const service = createService({
      repository,
      guard: {
        async assertFileAliasReferenceableForUpdate() {
          throw new FileAliasUnavailableError();
        },
      },
    });

    await assert.rejects(
      () => service.createWorkbook(command()),
      WorkbookFileUnavailableError,
    );
    assert.equal(repository.findForUpdateCalls, 0);
  });

  it("promotes source-owned workbooks to standalone for user-facing create", async () => {
    const repository = new FakeWorkbookRepository();
    repository.existingWorkbook = workbookWith({
      origin: "source_artifact",
      status: "valid",
    });
    const service = createService({
      repository,
      guard: { async assertFileAliasReferenceableForUpdate() {} },
    });

    const result = await service.createWorkbook(command());

    assert.equal(result.workbook.origin, "standalone");
    assert.equal(repository.promotedWorkbooks.length, 1);
    assert.equal(repository.createdWorkbooks.length, 0);
  });

  it("rejects deleted existing workbooks instead of reusing them", async () => {
    const repository = new FakeWorkbookRepository();
    repository.existingWorkbook = workbookWith({
      origin: "standalone",
      status: "deleted",
    });
    const service = createService({
      repository,
      guard: { async assertFileAliasReferenceableForUpdate() {} },
    });

    await assert.rejects(
      () => service.createWorkbook(command()),
      WorkbookFileUnavailableError,
    );
    assert.equal(repository.createdWorkbooks.length, 0);
    assert.equal(repository.promotedWorkbooks.length, 0);
  });

  it("maps expected unavailable aliases to WorkbookFileUnavailableError", async () => {
    const service = createService({
      guard: {
        async assertFileAliasReferenceableForUpdate() {
          throw new FileAliasUnavailableError();
        },
      },
    });

    await assert.rejects(
      () => service.createWorkbook(command()),
      WorkbookFileUnavailableError,
    );
  });

  it("rethrows unexpected file guard errors", async () => {
    const unexpected = new Error("database unavailable");
    const service = createService({
      guard: {
        async assertFileAliasReferenceableForUpdate() {
          throw unexpected;
        },
      },
    });

    await assert.rejects(() => service.createWorkbook(command()), unexpected);
  });
});

function createService(input: {
  guard: FileReferenceGuardPort;
  repository?: FakeWorkbookRepository;
}): WorkbookService {
  const repository = input.repository ?? new FakeWorkbookRepository();
  return new WorkbookService({
    clock: { now: () => at },
    idGenerator: {
      eventId: () => eventId("019e9315-6a87-715f-9861-8654df160004"),
      workbookCalculationId: () =>
        workbookCalculationId("019e9315-6a87-715f-9861-8654df160005"),
      workbookId: () => targetWorkbookId,
      workbookSnapshotId: () =>
        workbookSnapshotId("019e9315-6a87-715f-9861-8654df160006"),
    },
    workbookCalculator: {} as WorkbookCalculator,
    workbookEngine: "libreoffice",
    workbookFileProvider: new FakeWorkbookFileProvider(),
    // Focused repository fake: implements only methods exercised by these
    // WorkbookService create-from-file tests.
    workbookRepository: repository as unknown as WorkbookRepository,
    workbookTransaction: new FakeWorkbookTransaction(repository, input.guard),
  });
}

function command() {
  return {
    currentUser: currentUser(),
    fileId: targetFileId,
    lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df160007"),
    name: "Standalone workbook",
  };
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: createUser(
      {
        displayName: "Owner",
        email: "owner@example.com",
        id: ownerUserId,
        identityId: `oidc:${ownerUserId}`,
      },
      at,
    ),
  };
}

function workbookWith(input: {
  origin: Workbook["origin"];
  status: Workbook["status"];
}): Workbook {
  return {
    ...createWorkbook(
      {
        checksumSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        createdByUserId: ownerUserId,
        engine: "libreoffice",
        fileId: targetFileId,
        id: targetWorkbookId,
        name: "Existing workbook",
        originalName: "workbook.xlsx",
        origin: input.origin,
        ownerUserId,
      },
      at,
    ),
    status: input.status,
  };
}

class FakeWorkbookFileProvider implements WorkbookFileProviderPort {
  async getWorkbookFileMetadata(): Promise<{
    fileId: FileId;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
  }> {
    return {
      byteSize: 1234,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileId: targetFileId,
      originalName: "workbook.xlsx",
    };
  }

  async getWorkbookFileMetadataForOwnerUserId(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async readWorkbookFileContent(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async readWorkbookFileContentForOwnerUserId(): Promise<never> {
    throw new Error("Not implemented.");
  }
}

class FakeWorkbookTransaction implements WorkbookTransactionPort {
  constructor(
    private readonly repository: FakeWorkbookRepository,
    private readonly guard: FileReferenceGuardPort,
  ) {}

  async transaction<T>(
    fn: (deps: {
      fileReferenceGuard: FileReferenceGuardPort;
      workbookRepository: WorkbookRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({
      fileReferenceGuard: this.guard,
      // Focused outbox fake: these create-workbook tests do not exercise
      // outbox persistence behavior.
      outboxRepository:
        new FakeOutboxRepository() as unknown as OutboxRepository,
      // Focused transaction repository fake: only create/reuse/promote methods
      // used by WorkbookService are implemented.
      workbookRepository: this.repository as unknown as WorkbookRepository,
    });
  }
}

class FakeWorkbookRepository {
  readonly createdWorkbooks: Workbook[] = [];
  readonly promotedWorkbooks: Workbook[] = [];
  existingWorkbook: Workbook | null = null;
  findForUpdateCalls = 0;

  async findWorkbookByOwnerUserIdAndFileId(): Promise<Workbook | null> {
    return this.existingWorkbook;
  }

  async findWorkbookByOwnerUserIdAndFileIdForUpdate(): Promise<Workbook | null> {
    this.findForUpdateCalls += 1;
    return this.existingWorkbook;
  }

  async createWorkbook(workbook: Workbook): Promise<Workbook> {
    this.createdWorkbooks.push(workbook);
    return workbook;
  }

  async promoteWorkbookToStandalone(workbook: Workbook): Promise<Workbook> {
    this.promotedWorkbooks.push(workbook);
    this.existingWorkbook = workbook;
    return workbook;
  }
}

class FakeOutboxRepository {
  async appendEvents(): Promise<void> {}
}
