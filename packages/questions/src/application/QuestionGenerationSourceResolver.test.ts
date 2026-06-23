import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayName, emailAddress, identityId } from "@lemma/identity/domain";
import {
  createQuestionBlueprint,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVisibility,
  userId as toUserId,
  workbookId as toWorkbookId,
  type WorkbookId,
} from "../domain/index.js";
import { ForbiddenQuestionActionError } from "./errors.js";
import type { WorkbookAccessPort } from "./ports.js";
import { QuestionGenerationSourceResolver } from "./QuestionGenerationSourceResolver.js";

const ownerUserId = toUserId("019e9315-6a87-715f-9861-8654df070c50");
const workbookId = toWorkbookId("019e9315-6a87-715f-9861-8654df070c51");
const currentUser = {
  isAdmin: false,
  roles: [],
  user: {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    displayName: displayName("Test"),
    email: emailAddress("test@example.com"),
    id: ownerUserId,
    identityId: identityId("oidc:test-user"),
    status: "active",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
} as const;

describe("QuestionGenerationSourceResolver", () => {
  it("allows generation when all used workbook sources are accessible", async () => {
    const resolver = createResolver({ accessibleWorkbooks: [workbookId] });

    await resolver.assertAccess({
      blueprint: createBlueprint({ workbookId }),
      currentUser,
    });
  });

  it("rejects generation when a used workbook source is inaccessible", async () => {
    const resolver = createResolver({ accessibleWorkbooks: [] });

    await assert.rejects(
      () =>
        resolver.assertAccess({
          blueprint: createBlueprint({ workbookId }),
          currentUser,
        }),
      ForbiddenQuestionActionError,
    );
  });
});

function createResolver(input: { accessibleWorkbooks: readonly WorkbookId[] }) {
  return new QuestionGenerationSourceResolver({
    workbookAccessPort: {
      async canUserAccessWorkbook({ workbookId }) {
        return input.accessibleWorkbooks.includes(workbookId);
      },
    } satisfies WorkbookAccessPort,
  });
}

function createBlueprint(input: { workbookId: WorkbookId }) {
  return createQuestionBlueprint(
    {
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: questionBlueprintDocument({
        blocks: [],
        references: [
          {
            id: "workbook:source_1:cell:Sheet1:A1",
            source: {
              ref: "Sheet1!A1",
              schemaVersion: 1,
              sourceId: "source_1",
              type: "workbook_cell",
            },
          },
        ],
        responseFields: [],
        schemaVersion: 1,
      }),
      id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c59"),
      name: questionBlueprintName("Revenue"),
      ownerUserId,
      sources: [
        {
          name: "Source 1",
          sourceId: "source_1",
          type: "workbook",
          workbookId: input.workbookId,
        },
      ],
      visibility: questionBlueprintVisibility("private"),
    },
    new Date("2026-01-01T00:00:00.000Z"),
  );
}
