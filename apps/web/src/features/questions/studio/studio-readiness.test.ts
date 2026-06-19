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
  questionName: "Blueprint",
  hasWorkbookSelection: true,
  hasWorkbookPreview: true,
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

  it("requires blueprint name before save or generation", () => {
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
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Prompt only" }],
        },
      ],
      responseFields: [],
      references: [],
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
      references: [
        {
          id: "revenue",
          source: {
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "'Sheet1'!A1",
          },
        },
      ],
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "revenue" }],
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
    };

    const readiness = getStudioReadiness(model, {
      ...readyContext,
      hasWorkbookSelection: false,
    });

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "Select a workbook to reference cells.",
    );
    expect(
      getFirstReadinessIssueMessage(readiness, "generate_saved_blueprint"),
    ).toBe("Select a workbook to reference cells.");
  });

  it("blocks malformed workbook references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      references: [
        {
          id: "revenue",
          source: {
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "'Sheet1'!A1:B2",
          },
        },
      ],
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "revenue" }],
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "A workbook-backed reference needs a valid source cell or range.",
    );
  });

  it("does not require source readiness for unused workbook-backed references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      references: [
        {
          id: "unused",
          source: {
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "'Sheet1'!A1",
          },
        },
      ],
    };

    const readiness = getStudioReadiness(model, {
      ...readyContext,
      hasWorkbookSelection: false,
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
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "missing" }],
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "A text reference points to a missing reference.",
    );
  });

  it("accepts rich text references with existing references", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          id: "rich_text_1",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "reference", referenceId: "reference_1" }],
              },
            ],
          },
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
          id: "rich_text_1",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "reference", referenceId: "missing" }],
              },
            ],
          },
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "A rich text reference points to a missing reference.",
    );
  });

  it("reports answer blocks with missing response fields", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "literal", value: "" },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [],
      references: [],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "An answer block is missing its answer field.",
    );
  });

  it("reports table answer cells that reference missing response fields", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        createTableBlock("table_1", {
          prompt: "",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          responseFields: [],
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "response",
              responseFieldId: "answer_1",
              correctValueSource: { type: "literal", value: 1 },
              points: 1,
              grading: { mode: "exact" },
            },
          ],
        }),
      ],
      responseFields: [],
      references: [],
    };

    const readiness = getStudioReadiness(model, readyContext);

    expect(getFirstReadinessIssueMessage(readiness, "save")).toBe(
      "An answer cell is missing its answer field.",
    );
  });
});
