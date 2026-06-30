import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createTableBlock,
} from "#/domains/questions/authoring";
import type { StudioWorkbookSource } from "./source/studio-source-model";
import {
  getFirstReadinessIssueMessage,
  getStudioReadiness,
  type StudioReadinessContext,
} from "./studio-readiness";

const readyContext: StudioReadinessContext = {
  attachedSources: [
    {
      name: "Source 1",
      sourceId: "source_1",
      type: "workbook",
      workbookId: "workbook_1",
    },
  ],
  questionName: "Blueprint",
};

describe("studio readiness", () => {
  it("allows save and saved-blueprint generation for complete document", () => {
    const readiness = getStudioReadiness(
      createDefaultComposedEditorModel(),
      readyContext,
    );

    expect(readiness.canSave).toBe(true);
    expect(readiness.canGenerate).toBe(true);
    expect(
      readiness.issues.filter((issue) => issue.severity === "error"),
    ).toEqual([]);
  });

  it("requires draft name before save or generation", () => {
    const readiness = getStudioReadiness(createDefaultComposedEditorModel(), {
      ...readyContext,
      questionName: " ",
    });

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "Add a blueprint name.",
    );
    expect(
      getFirstReadinessIssueMessage(readiness, "generate_saved_blueprint"),
    ).toBe("Add a blueprint name.");
  });

  it("requires at least one answer before generating", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Prompt only", type: "text" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(readiness.canSave).toBe(true);
    expect(readiness.canGenerate).toBe(false);
    expect(getFirstReadinessIssueMessage(readiness, "save")).toBeNull();
    expect(
      getFirstReadinessIssueMessage(readiness, "generate_saved_blueprint"),
    ).toBe("Add at least one answer before generating.");
  });

  it("requires workbook selection for workbook-backed content", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: [{ referenceId: "revenue", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
      references: [
        {
          id: "revenue",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
    };

    const readiness = getStudioReadiness(model, {
      ...readyContext,
      attachedSources: [],
    });

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "Add a workbook before saving.",
    );
    expect(
      getFirstReadinessIssueMessage(readiness, "generate_saved_blueprint"),
    ).toBe("Add a workbook before saving.");
  });

  it("blocks malformed workbook references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: [{ referenceId: "revenue", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
      references: [
        {
          id: "revenue",
          source: {
            ref: "'Sheet1'!A1:B2",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "A workbook value needs an attached workbook.",
    );
  });

  it("does not require source readiness for unused workbook-backed references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      references: [
        {
          id: "unused",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
    };

    const readiness = getStudioReadiness(model, {
      ...readyContext,
      attachedSources: [],
    });

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBeNull();
    expect(
      getFirstReadinessIssueMessage(readiness, "generate_saved_blueprint"),
    ).toBeNull();
  });

  it("reports text references that point to missing references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: [{ referenceId: "missing", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "Text uses a value that is no longer available.",
    );
  });

  it("uses recovery copy when inserted workbook values are unavailable", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: [{ referenceId: "revenue", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
      references: [
        {
          id: "revenue",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
    };

    const readiness = getStudioReadiness(model, {
      ...readyContext,
      sources: [missingSource("source_1")],
    });

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "Some inserted values need attention.",
    );
    expect(getFirstReadinessIssueMessage(readiness, "publish")).toBe(
      "Review affected values before publishing.",
    );
  });

  it("allows save but blocks publish while inserted workbook values are unknown", () => {
    const readiness = getStudioReadiness(modelWithWorkbookValue(), {
      ...readyContext,
      sources: [persistedSourceWithoutPreview("source_1")],
    });

    expect(readiness.canSave).toBe(true);
    expect(readiness.canGenerate).toBe(false);
    expect(getFirstReadinessIssueMessage(readiness, "save")).toBeNull();
    expect(getFirstReadinessIssueMessage(readiness, "publish")).toBe(
      "Wait for workbook values to finish loading before publishing.",
    );
    expect(readiness.issues).toContainEqual(
      expect.objectContaining({
        message: "Some inserted values are still being checked.",
        severity: "warning",
      }),
    );
  });

  it("treats draft file loading as checking and failed as blocking", () => {
    const checking = getStudioReadiness(modelWithWorkbookValue(), {
      ...readyContext,
      sources: [draftFileSource("source_1", "loading")],
    });
    const failed = getStudioReadiness(modelWithWorkbookValue(), {
      ...readyContext,
      sources: [draftFileSource("source_1", "failed")],
    });

    expect(checking.canSave).toBe(true);
    expect(getFirstReadinessIssueMessage(checking, "publish")).toBe(
      "Wait for workbook values to finish loading before publishing.",
    );
    expect(failed.canSave).toBe(false);
    expect(getFirstReadinessIssueMessage(failed, "save")).toBe(
      "Some inserted values need attention.",
    );
  });

  it("accepts rich text references with existing references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: {
            content: [
              {
                content: [{ referenceId: "reference_1", type: "reference" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          id: "rich_text_1",
          type: "rich_text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
      references: [
        { id: "reference_1", source: { type: "literal", value: "A" } },
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBeNull();
  });

  it("reports rich text references that point to missing references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: {
            content: [
              {
                content: [{ referenceId: "missing", type: "reference" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          id: "rich_text_1",
          type: "rich_text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "Rich text uses a value that is no longer available.",
    );
  });

  it("reports answer blocks with missing response fields", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          correctValueSource: { type: "literal", value: "" },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "An answer block is missing its answer field.",
    );
  });

  it("reports table answer cells that reference missing response fields", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTableBlock("table_1", {
          cells: [
            {
              blocks: [
                {
                  correctValueSource: { type: "literal", value: 1 },
                  grading: { mode: "exact" },
                  id: "input_1",
                  points: 1,
                  responseFieldId: "answer_1",
                  type: "input",
                },
              ],
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
            },
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          prompt: "",
          responseFields: [],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
        }),
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "An answer cell is missing its answer field.",
    );
  });
});

function missingSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      kind: "missing_local_file",
      lastModified: 1,
      originalName: `${sourceId}.xlsx`,
      parseError: "Workbook file missing. Reattach the file to continue.",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function persistedSourceWithoutPreview(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: null,
      kind: "persisted_workbook",
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      workbookId: `${sourceId}-workbook`,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function draftFileSource(
  sourceId: string,
  previewStatus: "idle" | "loading" | "loaded" | "failed",
): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      checksumSha256: "checksum-1",
      fileId: "file-1",
      kind: "draft_file",
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      previewError: previewStatus === "failed" ? "Failed" : null,
      previewStatus,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function modelWithWorkbookValue(): ComposedEditorModel {
  return {
    ...createDefaultComposedEditorModel(),
    blocks: [
      {
        content: [{ referenceId: "revenue", type: "reference" }],
        id: "text_1",
        type: "text",
      },
      ...createDefaultComposedEditorModel().blocks.filter(
        (block) => block.type === "response",
      ),
    ],
    references: [
      {
        id: "revenue",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ],
  };
}
