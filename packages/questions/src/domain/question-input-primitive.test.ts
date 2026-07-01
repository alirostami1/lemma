import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  materializeQuestionInputPrimitive,
  questionBlueprintDocument,
  validateQuestionBlueprintInputPrimitiveConfig,
  validateQuestionInputPrimitiveConfig,
  validateQuestionInputPrimitiveValue,
} from "./index.js";

describe("question input primitive", () => {
  it("validates text input required and regex rules", () => {
    const input = {
      schemaVersion: 1 as const,
      type: "text" as const,
      validation: { regex: "^[A-Z]{3}$", required: true },
    };

    assert.deepEqual(validateQuestionInputPrimitiveValue(input, ""), {
      errors: [{ code: "required", message: "Enter an answer." }],
      valid: false,
    });
    assert.deepEqual(validateQuestionInputPrimitiveValue(input, "ab1"), {
      errors: [{ code: "regex", message: "Use the required format." }],
      valid: false,
    });
    assert.deepEqual(validateQuestionInputPrimitiveValue(input, "ABC"), {
      errors: [],
      valid: true,
    });
  });

  it("validates number input min and max rules", () => {
    const input = {
      schemaVersion: 1 as const,
      type: "number" as const,
      validation: { max: 10, min: 2, required: true },
    };

    assert.equal(validateQuestionInputPrimitiveValue(input, 1).valid, false);
    assert.equal(validateQuestionInputPrimitiveValue(input, 11).valid, false);
    assert.deepEqual(validateQuestionInputPrimitiveValue(input, 5), {
      errors: [],
      valid: true,
    });
  });

  it("validates select input options and allowed values", () => {
    const input = {
      options: [
        { label: "Alpha", value: "a" },
        { label: "Bravo", value: "b" },
        { label: "Charlie", value: "c" },
      ],
      schemaVersion: 1 as const,
      type: "select" as const,
      validation: { allowedValues: ["a", "b"], required: true },
    };

    assert.equal(validateQuestionInputPrimitiveValue(input, "x").valid, false);
    assert.equal(validateQuestionInputPrimitiveValue(input, "c").valid, false);
    assert.deepEqual(validateQuestionInputPrimitiveValue(input, "a"), {
      errors: [],
      valid: true,
    });
  });

  it("rejects non-empty select values when no accepted values exist", () => {
    const input = {
      options: [],
      schemaVersion: 1 as const,
      type: "select" as const,
    };

    assert.deepEqual(validateQuestionInputPrimitiveValue(input, ""), {
      errors: [],
      valid: true,
    });
    assert.deepEqual(validateQuestionInputPrimitiveValue(input, "a"), {
      errors: [
        {
          code: "allowed_value",
          message: "Choose one of the available options.",
        },
      ],
      valid: false,
    });
  });

  it("validates select configuration", () => {
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "a" }, { value: "b" }],
        type: "select",
        validation: { allowedValues: ["a"] },
      }).valid,
      true,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "a" }, { value: "b" }],
        type: "select",
        validation: { allowedValues: ["c"] },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "a" }, { value: "a" }],
        type: "select",
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "" }],
        type: "select",
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "a" }],
        type: "select",
        validation: { allowedValues: ["a", "a"] },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "a" }],
        type: "select",
        validation: { allowedValues: [""] },
      }).valid,
      false,
    );
  });

  it("rejects invalid primitive config combinations", () => {
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        type: "number",
        validation: { min: 10, max: 1 },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        type: "number",
        validation: { regex: "^a$" },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        type: "select",
        validation: { regex: "^a$" },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionInputPrimitiveConfig({
        options: [{ value: "a" }],
        type: "text",
      }).valid,
      false,
    );
  });

  it("validates source-backed blueprint input configuration", () => {
    const sourceOptions = {
      referenceId: "choices",
      schemaVersion: 1 as const,
      type: "reference" as const,
    };

    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        defaultValueSource: {
          schemaVersion: 1,
          type: "literal",
          value: "outside",
        },
        optionsSource: sourceOptions,
        schemaVersion: 1,
        type: "select",
        validation: { allowedValues: ["a"] },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        optionsSource: sourceOptions,
        schemaVersion: 1,
        type: "select",
        validation: { allowedValues: ["a", "a"] },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        optionsSource: sourceOptions,
        schemaVersion: 1,
        type: "select",
        validation: { regex: "^a$" },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        optionsSource: sourceOptions,
        schemaVersion: 1,
        type: "select",
        validation: { min: 1, max: 2 },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        optionsSource: sourceOptions,
        schemaVersion: 1,
        type: "select",
        validation: { allowedValues: ["a"] },
      }).valid,
      true,
    );
  });

  it("validates literal blueprint options against allowed values and default", () => {
    const optionsSource = {
      schemaVersion: 1 as const,
      type: "literal" as const,
      value: [{ value: "a" }, { value: "b" }],
    };

    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        optionsSource,
        schemaVersion: 1,
        type: "select",
        validation: { allowedValues: ["outside"] },
      }).valid,
      false,
    );
    assert.equal(
      validateQuestionBlueprintInputPrimitiveConfig({
        defaultValueSource: {
          schemaVersion: 1,
          type: "literal",
          value: "outside",
        },
        optionsSource,
        schemaVersion: 1,
        type: "select",
      }).valid,
      false,
    );
  });

  it("handles invalid regex without throwing at runtime", () => {
    const input = {
      schemaVersion: 1 as const,
      type: "text" as const,
      validation: { regex: "[" },
    };

    assert.doesNotThrow(() =>
      validateQuestionInputPrimitiveValue(input, "anything"),
    );
    assert.deepEqual(validateQuestionInputPrimitiveValue(input, "anything"), {
      errors: [
        { code: "invalid_config", message: "Answer format is invalid." },
      ],
      valid: false,
    });
  });

  it("validates defaults after materialization", () => {
    assert.throws(
      () =>
        materializeQuestionInputPrimitive(
          {
            defaultValueSource: {
              schemaVersion: 1,
              type: "literal",
              value: "c",
            },
            optionsSource: {
              schemaVersion: 1,
              type: "literal",
              value: [
                { label: "Alpha", value: "a" },
                { label: "Bravo", value: "b" },
              ],
            },
            schemaVersion: 1,
            type: "select",
            validation: { allowedValues: ["a", "b"] },
          },
          (source) => (source.type === "literal" ? source.value : null),
          (message) => {
            throw new Error(message);
          },
        ),
      /Default answer must be one of the available options/,
    );
  });

  it("rejects resolved options that omit allowed values", () => {
    assert.throws(
      () =>
        materializeQuestionInputPrimitive(
          {
            optionsSource: {
              referenceId: "choices",
              schemaVersion: 1,
              type: "reference",
            },
            schemaVersion: 1,
            type: "select",
            validation: { allowedValues: ["a", "b"] },
          },
          () => [{ value: "a" }],
          (message) => {
            throw new Error(message);
          },
        ),
      /Allowed values must match available options/,
    );
  });

  it("rejects invalid typed default values", () => {
    assert.throws(
      () =>
        questionBlueprintDocument({
          blocks: [
            {
              correctValueSource: {
                schemaVersion: 1,
                type: "literal",
                value: 4,
              },
              grading: { mode: "exact" },
              id: "answer_block",
              input: {
                defaultValueSource: {
                  schemaVersion: 1,
                  type: "literal",
                  value: "not a number",
                },
                schemaVersion: 1,
                type: "number",
              },
              kind: "primitive",
              points: 1,
              responseFieldId: "answer",
              type: "input",
            },
          ],
          references: [],
          responseFields: [{ id: "answer", type: "number" }],
          schemaVersion: 2,
        }),
      /default value must be a finite number/,
    );
  });

  it("migrates legacy required into the input primitive", () => {
    const document = questionBlueprintDocument({
      blocks: [
        {
          correctValueSource: { schemaVersion: 1, type: "literal", value: "" },
          grading: { mode: "exact" },
          id: "answer_block",
          input: {
            schemaVersion: 1,
            type: "text",
          },
          kind: "primitive",
          points: 1,
          responseFieldId: "answer",
          type: "input",
        },
      ],
      references: [],
      responseFields: [{ id: "answer", required: true, type: "text" }],
      schemaVersion: 2,
    });

    const block = document.blocks[0];
    if (block?.kind !== "primitive" || block.type !== "input") {
      assert.fail("expected input block");
    }
    assert.deepEqual(block.input.validation, { required: true });
  });

  it("rejects required mismatches between response field and primitive", () => {
    assert.throws(
      () =>
        questionBlueprintDocument({
          blocks: [
            {
              correctValueSource: {
                schemaVersion: 1,
                type: "literal",
                value: "",
              },
              grading: { mode: "exact" },
              id: "answer_block",
              input: {
                schemaVersion: 1,
                type: "text",
                validation: { required: false },
              },
              kind: "primitive",
              points: 1,
              responseFieldId: "answer",
              type: "input",
            },
          ],
          references: [],
          responseFields: [{ id: "answer", required: true, type: "text" }],
          schemaVersion: 2,
        }),
      /required must match response field/,
    );
  });

  it("applies the required migration rule to table cells", () => {
    const document = questionBlueprintDocument({
      blocks: [
        {
          cells: [
            {
              blocks: [
                {
                  correctValueSource: {
                    schemaVersion: 1,
                    type: "literal",
                    value: 1,
                  },
                  grading: { mode: "exact" },
                  id: "cell_input",
                  input: {
                    schemaVersion: 1,
                    type: "number",
                  },
                  kind: "primitive",
                  points: 1,
                  responseFieldId: "answer",
                  type: "input",
                },
              ],
              columnId: "column",
              id: "cell",
              rowId: "row",
            },
          ],
          columns: [{ id: "column", label: "Column" }],
          id: "table",
          kind: "complex",
          rows: [{ id: "row", label: "Row" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      references: [],
      responseFields: [{ id: "answer", required: true, type: "number" }],
      schemaVersion: 2,
    });

    const table = document.blocks[0];
    if (table?.type !== "table") {
      assert.fail("expected table");
    }
    const block = table.cells[0]?.blocks[0];
    if (block?.type !== "input") {
      assert.fail("expected input");
    }
    assert.deepEqual(block.input.validation, { required: true });
  });

  it("represents reference-backed defaults and options without special cases", () => {
    const document = questionBlueprintDocument({
      blocks: [
        {
          correctValueSource: {
            schemaVersion: 1,
            type: "literal",
            value: "b",
          },
          grading: { mode: "exact" },
          id: "answer_block",
          input: {
            defaultValueSource: {
              referenceId: "default_choice",
              schemaVersion: 1,
              type: "reference",
            },
            optionsSource: {
              referenceId: "choices",
              schemaVersion: 1,
              type: "reference",
            },
            schemaVersion: 1,
            type: "select",
            validation: { allowedValues: ["a", "b"], required: true },
          },
          kind: "primitive",
          points: 1,
          responseFieldId: "answer",
          type: "input",
        },
      ],
      references: [
        {
          id: "default_choice",
          source: { schemaVersion: 1, type: "literal", value: "b" },
        },
        {
          id: "choices",
          source: {
            schemaVersion: 1,
            type: "literal",
            value: [
              { label: "Alpha", value: "a" },
              { label: "Bravo", value: "b" },
            ],
          },
        },
      ],
      responseFields: [{ id: "answer", type: "select" }],
      schemaVersion: 2,
    });

    const block = document.blocks[0];
    if (block?.kind !== "primitive" || block.type !== "input") {
      assert.fail("expected input block");
    }
    assert.deepEqual(block.input.defaultValueSource, {
      referenceId: "default_choice",
      schemaVersion: 1,
      type: "reference",
    });
    assert.deepEqual(block.input.optionsSource, {
      referenceId: "choices",
      schemaVersion: 1,
      type: "reference",
    });
  });
});
