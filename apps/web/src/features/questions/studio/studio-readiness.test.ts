import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createTableBlock,
} from "#/domains/questions/authoring";
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
              columnId: "column_1",
              correctValueSource: { type: "literal", value: 1 },
              grading: { mode: "exact" },
              id: "cell_1",
              points: 1,
              responseFieldId: "answer_1",
              rowId: "row_1",
              type: "response",
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
      schemaVersion: 1,
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "An answer cell is missing its answer field.",
    );
  });
});
