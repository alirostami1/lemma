import { describe, expect, it } from "vitest";
import {
  applyInputGrading,
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createDefaultTableEditorModel,
  createReferenceDraft,
  createResponseBlock,
  createTableBlock,
  createTextBlock,
  extractUsedReferenceIdsFromComposedEditorModel,
  extractWorkbookReferenceRefsFromComposedEditorModel,
  getComposedEditorReferenceUsage,
  getReferenceUsage,
  getUnusedComposedReferences,
  type InputPrimitive,
  inputPrimitivePreviewStateFromEditorInput,
  normalizeInputPrimitiveForType,
  stripUnusedComposedReferences,
  type TableEditorInputBlock,
  tableEditorModelToStaticPreviewModel,
  validateInputPrimitiveConfig,
} from "#/domains/questions/authoring";
import { validateComposedEditorModel } from "./canonical/validation";

describe("composed authoring helpers", () => {
  it("namespaces default table primitive ids by table block id", () => {
    const tables = [createTableBlock("table_1"), createTableBlock("table_2")];
    const primitiveIds = tables.flatMap((table) =>
      table.table.cells.flatMap((cell) => cell.blocks.map((block) => block.id)),
    );

    expect(new Set(primitiveIds).size).toBe(primitiveIds.length);
  });

  it("creates a default composed editor model", () => {
    expect(createDefaultComposedEditorModel()).toEqual({
      blocks: [
        {
          content: [{ text: "Write the question here.", type: "text" }],
          id: "text_1",
          type: "text",
        },
        {
          correctValueSource: { type: "literal", value: "" },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            type: "text",
            validation: { required: true },
          },
          label: undefined,
          placeholder: "Answer",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          type: "text",
        },
      ],
      schemaVersion: 2,
    });
  });

  it("does not make missing input normalization required by default", () => {
    expect(normalizeInputPrimitiveForType(undefined, "text")).toEqual({
      type: "text",
    });
    expect(
      normalizeInputPrimitiveForType(undefined, "text", {
        requiredFallback: true,
      }),
    ).toEqual({
      type: "text",
      validation: { required: true },
    });
  });

  it("creates new table answer cells as required through the creation path", () => {
    const inputBlock = createDefaultTableEditorModel().cells[1]?.blocks[0];

    expect(inputBlock).toMatchObject({
      input: { validation: { required: true } },
      type: "input",
    });
  });

  it("marks reference-backed select options as unresolved in authoring preview", () => {
    expect(
      inputPrimitivePreviewStateFromEditorInput(
        {
          optionsSource: { referenceId: "choices", type: "reference" },
          type: "select",
          validation: { allowedValues: ["a"], required: true },
        },
        { type: "select" },
      ),
    ).toEqual({
      input: {
        optionsSource: { referenceId: "choices", type: "reference" },
        type: "select",
        validation: { allowedValues: ["a"], required: true },
      },
      message: "Options are not available in this preview.",
      status: "unresolved_options",
    });
  });

  it("materializes literal select options in authoring preview", () => {
    expect(
      inputPrimitivePreviewStateFromEditorInput(
        {
          optionsSource: {
            type: "literal",
            value: [{ label: "Alpha", value: "a" }],
          },
          type: "select",
          validation: { allowedValues: ["a"] },
        },
        { type: "select" },
      ),
    ).toEqual({
      input: {
        options: [{ label: "Alpha", value: "a" }],
        type: "select",
        validation: { allowedValues: ["a"] },
      },
      status: "materialized",
    });
  });

  it("validates reference-backed select options without materializing them", () => {
    expect(
      validateInputPrimitiveConfig({
        optionsSource: { referenceId: "choices", type: "reference" },
        type: "select",
        validation: { allowedValues: ["a", "b"] },
      }),
    ).toEqual({ errors: [], valid: true });
  });

  it.each([
    [
      "duplicate allowed values",
      { allowedValues: ["a", "a"] },
      "Allowed value a is duplicated.",
    ],
    [
      "literal default outside allowed values",
      { allowedValues: ["a"] },
      "Default answer must be one of the accepted values.",
      "b",
    ],
    [
      "regex validation",
      { regex: "^a$" },
      "Only text answers can use a required format.",
    ],
    [
      "minimum validation",
      { min: 1 },
      "Only number answers can use a minimum.",
    ],
    [
      "maximum validation",
      { max: 1 },
      "Only number answers can use a maximum.",
    ],
  ])("rejects reference-backed select %s", (_name, validation, message, defaultValue?) => {
    const result = validateInputPrimitiveConfig({
      ...(defaultValue === undefined
        ? {}
        : {
            defaultValueSource: {
              type: "literal" as const,
              value: defaultValue,
            },
          }),
      optionsSource: { referenceId: "choices", type: "reference" },
      type: "select",
      validation,
    });

    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContainEqual(expect.objectContaining({ message }));
  });

  it("rejects invalid literal default types without coercing them", () => {
    // Represents persisted or transport-corrupted data rejected by TypeScript.
    const input = {
      defaultValueSource: { type: "literal", value: { invalid: true } },
      type: "text",
    } as unknown as InputPrimitive;

    expect(validateInputPrimitiveConfig(input)).toMatchObject({
      errors: [
        expect.objectContaining({
          code: "invalid_default",
          message: "default value must be a string",
        }),
      ],
      valid: false,
    });
  });

  it("applies the input grading correct-source contract", () => {
    const manualInput: TableEditorInputBlock = {
      grading: { mode: "manual" },
      id: "input_1",
      points: 1,
      responseFieldId: "answer_1",
      type: "input",
    };
    const exactInput = applyInputGrading(manualInput, { mode: "exact" });

    expect(exactInput).toEqual({
      ...manualInput,
      correctValueSource: { type: "literal", value: "" },
      grading: { mode: "exact" },
    });
    expect(
      applyInputGrading(
        {
          ...exactInput,
          correctValueSource: { type: "literal", value: 42 },
        },
        { mode: "manual" },
      ),
    ).toEqual({
      ...manualInput,
      grading: { mode: "manual" },
    });
  });

  it("rejects non-manual inputs without a correct value source", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            type: "text",
          },
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [{ id: "answer_1", type: "text" }],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Input block response_1 is missing correct value source for exact grading.",
    );
  });

  it("rejects nested non-manual inputs without a correct value source", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          blocks: [
            {
              grading: { mode: "case_insensitive_text" },
              id: "response_1",
              points: 1,
              responseFieldId: "answer_1",
              type: "response",
            },
          ],
          containerType: "page",
          id: "page_1",
          type: "container",
        },
      ],
      references: [],
      responseFields: [{ id: "answer_1", type: "text" }],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Input block response_1 is missing correct value source for case_insensitive_text grading.",
    );
  });

  it.each([
    [
      "invalid regex",
      {
        type: "text" as const,
        validation: { regex: "[" },
      },
      "Answer format is invalid.",
    ],
    [
      "number min greater than max",
      {
        type: "number" as const,
        validation: { max: 1, min: 10 },
      },
      "Minimum must be no greater than maximum.",
    ],
    [
      "duplicate select options",
      {
        optionsSource: {
          type: "literal" as const,
          value: [{ value: "a" }, { value: "a" }],
        },
        type: "select" as const,
      },
      "Option a is duplicated.",
    ],
    [
      "duplicate allowed values",
      {
        optionsSource: {
          type: "literal" as const,
          value: [{ value: "a" }],
        },
        type: "select" as const,
        validation: { allowedValues: ["a", "a"] },
      },
      "Allowed value a is duplicated.",
    ],
    [
      "allowed value outside options",
      {
        optionsSource: {
          type: "literal" as const,
          value: [{ value: "a" }],
        },
        type: "select" as const,
        validation: { allowedValues: ["b"] },
      },
      "Allowed values must match available options.",
    ],
    [
      "default outside accepted select values",
      {
        defaultValueSource: { type: "literal" as const, value: "b" },
        optionsSource: {
          type: "literal" as const,
          value: [{ value: "a" }],
        },
        type: "select" as const,
      },
      "Default answer must be one of the accepted values.",
    ],
    [
      "regex on number",
      {
        type: "number" as const,
        validation: { regex: "^a$" },
      },
      "Only text answers can use a required format.",
    ],
    [
      "regex on select",
      {
        optionsSource: { type: "literal" as const, value: [] },
        type: "select" as const,
        validation: { regex: "^a$" },
      },
      "Only text answers can use a required format.",
    ],
    [
      "min on text",
      {
        type: "text" as const,
        validation: { min: 1 },
      },
      "Only number answers can use a minimum.",
    ],
    [
      "max on select",
      {
        optionsSource: { type: "literal" as const, value: [] },
        type: "select" as const,
        validation: { max: 1 },
      },
      "Only number answers can use a maximum.",
    ],
    [
      "options on text",
      {
        optionsSource: {
          type: "literal" as const,
          value: [{ value: "a" }],
        },
        type: "text" as const,
      },
      "Only choice answers can define an options source.",
    ],
  ])("rejects invalid primitive config: %s", (_name, input, message) => {
    expect(() => validateComposedEditorModel(modelWithInput(input))).toThrow(
      message,
    );
  });

  it("rejects invalid table-cell primitive config", () => {
    expect(() =>
      validateComposedEditorModel(
        modelWithTableInput({
          optionsSource: {
            type: "literal",
            value: [{ value: "a" }, { value: "a" }],
          },
          type: "select",
        }),
      ),
    ).toThrow("Option a is duplicated.");
  });

  it("rejects table non-manual inputs without a correct value source", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTableBlock("table_1", {
          blockId: "table_1",
          cells: [
            {
              blocks: [
                {
                  grading: {
                    mode: "number",
                    tolerance: { type: "absolute", value: 0 },
                  },
                  id: "cell_input_1",
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
          columns: [{ id: "column_1", label: "Column" }],
          prompt: "",
          responseFields: [{ id: "answer_1", type: "number" }],
          rows: [{ id: "row_1", label: "Row" }],
          showColumnNames: true,
          showRowNames: true,
        }),
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Input block cell_input_1 in cell cell_1 is missing correct value source for number grading.",
    );
  });

  it("allows manual inputs without a correct value source", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          blocks: [
            {
              grading: { mode: "manual" },
              id: "response_1",
              points: 1,
              responseFieldId: "answer_1",
              type: "response",
            },
            createTableBlock("table_1", {
              blockId: "table_1",
              cells: [
                {
                  blocks: [
                    {
                      grading: { mode: "manual" },
                      id: "cell_input_1",
                      points: 1,
                      responseFieldId: "table_answer_1",
                      type: "input",
                    },
                  ],
                  columnId: "column_1",
                  id: "cell_1",
                  rowId: "row_1",
                },
              ],
              columns: [{ id: "column_1", label: "Column" }],
              prompt: "",
              responseFields: [{ id: "table_answer_1", type: "text" }],
              rows: [{ id: "row_1", label: "Row" }],
              showColumnNames: true,
              showRowNames: true,
            }),
          ],
          containerType: "page",
          id: "page_1",
          type: "container",
        },
      ],
      references: [],
      responseFields: [{ id: "answer_1", type: "text" }],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).not.toThrow();
  });

  it("creates a reference draft with a fresh id", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        { id: "reference_1", source: { type: "literal", value: "alpha" } },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(createReferenceDraft(model)).toEqual({
      id: "reference_2",
      source: { type: "literal", value: "" },
    });
  });

  it("extracts used reference ids and workbook refs", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTextBlock("text_1", "Hello"),
        {
          content: [
            { referenceId: "reference_1", type: "reference" },
            { referenceId: "reference_2", type: "reference" },
          ],
          id: "text_2",
          type: "text",
        },
        createResponseBlock("response_1", "answer_1", {
          correctValueSource: {
            referenceId: "answer_source",
            type: "reference",
          },
        }),
      ],
      references: [
        {
          id: "reference_1",
          source: {
            ref: "'Sheet1'!A1:B2",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
        {
          id: "reference_2",
          source: { type: "literal", value: "Bravo" },
        },
        {
          id: "answer_source",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([
      "reference_1",
      "reference_2",
      "answer_source",
    ]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!A1:B2",
      "'Sheet1'!A1",
    ]);
  });

  it("tracks exact reference usage locations", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "reference_1", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        {
          correctValueSource: {
            referenceId: "answer_source",
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            defaultValueSource: {
              referenceId: "answer_default",
              type: "reference",
            },
            optionsSource: {
              referenceId: "answer_options",
              type: "reference",
            },
            type: "select",
          },
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
        {
          id: "table_1",
          table: {
            cells: [
              {
                blocks: [
                  {
                    content: [
                      { referenceId: "content_ref", type: "reference" },
                    ],
                    id: "cell_text_1",
                    type: "text",
                  },
                  {
                    content: {
                      content: [
                        {
                          content: [
                            {
                              referenceId: "rich_ref",
                              type: "reference",
                            },
                          ],
                          type: "paragraph",
                        },
                      ],
                      type: "doc",
                    },
                    id: "cell_rich_1",
                    type: "rich_text",
                  },
                  {
                    correctValueSource: {
                      referenceId: "table_ref",
                      type: "reference",
                    },
                    grading: { mode: "exact" },
                    id: "cell_input_1",
                    input: {
                      defaultValueSource: {
                        referenceId: "table_default",
                        type: "reference",
                      },
                      optionsSource: {
                        referenceId: "table_options",
                        type: "reference",
                      },
                      type: "select",
                    },
                    points: 1,
                    responseFieldId: "table_answer_1",
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
            responseFields: [
              {
                id: "table_answer_1",
                type: "select",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [
        {
          id: "reference_1",
          source: { type: "literal", value: "alpha" },
        },
        {
          id: "answer_source",
          source: { type: "literal", value: "beta" },
        },
        {
          id: "content_ref",
          source: { type: "literal", value: "gamma" },
        },
        {
          id: "answer_default",
          source: { type: "literal", value: "a" },
        },
        {
          id: "answer_options",
          source: { type: "literal", value: ["a"] },
        },
        {
          id: "table_ref",
          source: { type: "literal", value: "delta" },
        },
        {
          id: "table_default",
          source: { type: "literal", value: "b" },
        },
        {
          id: "table_options",
          source: { type: "literal", value: ["b"] },
        },
        {
          id: "rich_ref",
          source: { type: "literal", value: "epsilon" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "select",
        },
      ],
      schemaVersion: 2,
    };

    expect(getReferenceUsage(model)).toEqual(
      new Map([
        [
          "reference_1",
          [
            {
              blockId: "text_1",
              inlineContentIndex: 0,
              type: "text_block",
            },
          ],
        ],
        [
          "answer_source",
          [
            {
              blockId: "response_1",
              responseFieldId: "answer_1",
              type: "response_answer",
            },
          ],
        ],
        [
          "answer_default",
          [
            {
              blockId: "response_1",
              responseFieldId: "answer_1",
              type: "response_input_default",
            },
          ],
        ],
        [
          "answer_options",
          [
            {
              blockId: "response_1",
              responseFieldId: "answer_1",
              type: "response_input_options",
            },
          ],
        ],
        [
          "content_ref",
          [
            {
              blockId: "table_1",
              cellId: "cell_1",
              cellBlockId: "cell_text_1",
              inlineContentIndex: 0,
              type: "table_content_cell",
            },
          ],
        ],
        [
          "rich_ref",
          [
            {
              blockId: "table_1",
              cellId: "cell_1",
              cellBlockId: "cell_rich_1",
              inlineContentIndex: 0,
              richNodePath: [0],
              type: "table_content_cell",
            },
          ],
        ],
        [
          "table_ref",
          [
            {
              blockId: "table_1",
              cellId: "cell_1",
              cellBlockId: "cell_input_1",
              responseFieldId: "table_answer_1",
              type: "table_answer_cell",
            },
          ],
        ],
        [
          "table_default",
          [
            {
              blockId: "table_1",
              cellId: "cell_1",
              cellBlockId: "cell_input_1",
              responseFieldId: "table_answer_1",
              type: "table_input_default",
            },
          ],
        ],
        [
          "table_options",
          [
            {
              blockId: "table_1",
              cellId: "cell_1",
              cellBlockId: "cell_input_1",
              responseFieldId: "table_answer_1",
              type: "table_input_options",
            },
          ],
        ],
      ]),
    );
  });

  it("strips unused references without changing live content", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "used_text", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        createResponseBlock("response_1", "answer_1", {
          correctValueSource: { referenceId: "used_answer", type: "reference" },
        }),
      ],
      references: [
        {
          id: "used_text",
          source: { type: "literal", value: "alpha" },
        },
        {
          id: "used_answer",
          source: { type: "literal", value: "beta" },
        },
        {
          id: "unused",
          source: { type: "literal", value: "gamma" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    expect(getComposedEditorReferenceUsage(model)).toEqual(
      getReferenceUsage(model),
    );
    expect(
      getUnusedComposedReferences(model).map((reference) => reference.id),
    ).toEqual(["unused"]);
    expect(stripUnusedComposedReferences(model)).toEqual({
      ...model,
      references: model.references.slice(0, 2),
    });
    expect(model.references.map((reference) => reference.id)).toEqual([
      "used_text",
      "used_answer",
      "unused",
    ]);
  });

  it("converts a table editor model to a static preview model", () => {
    expect(
      tableEditorModelToStaticPreviewModel({
        cells: [
          {
            blocks: [
              {
                content: [{ text: "001", type: "text" }],
                id: "cell_1_text",
                type: "text",
              },
            ],
            columnId: "column_1",
            id: "cell_1",
            rowId: "row_1",
          },
        ],
        columns: [{ id: "column_1", label: "Column 1" }],
        prompt: "Prompt",
        responseFields: [],
        rows: [{ id: "row_1", label: "Row 1" }],
        showColumnNames: true,
        showRowNames: true,
      }),
    ).toEqual({
      cells: [
        {
          blocks: [
            {
              content: [{ text: "001", type: "text" }],
              id: "cell_1_text",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      columns: [{ id: "column_1", label: "Column 1" }],
      prompt: "Prompt",
      responseFields: [],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
    });
  });
});

function modelWithInput(input: InputPrimitive): ComposedEditorModel {
  return {
    blocks: [
      {
        correctValueSource: { type: "literal", value: "" },
        grading: { mode: "exact" },
        id: "response_1",
        input,
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
    ],
    references: [],
    responseFields: [{ id: "answer_1", type: input.type }],
    schemaVersion: 2,
  };
}

function modelWithTableInput(input: InputPrimitive): ComposedEditorModel {
  return {
    blocks: [
      createTableBlock("table_1", {
        cells: [
          {
            blocks: [
              {
                correctValueSource: { type: "literal", value: "" },
                grading: { mode: "exact" },
                id: "cell_input_1",
                input,
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
        columns: [{ id: "column_1", label: "Column" }],
        prompt: "",
        responseFields: [{ id: "answer_1", type: input.type }],
        rows: [{ id: "row_1", label: "Row" }],
        showColumnNames: true,
        showRowNames: true,
      }),
    ],
    references: [],
    responseFields: [],
    schemaVersion: 2,
  };
}
