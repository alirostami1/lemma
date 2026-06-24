import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  addReferenceAndInsertIntoTextBlock,
  addReferenceToModel,
  appendReferenceToInlineContent,
  createReferenceDraftFromSource,
  createUniqueReferenceDraft,
  getReferenceSyntax,
  insertReferenceIntoSelectedTextBlock,
  removeUnusedReferenceFromModel,
  renameReferenceInModel,
} from "./reference-inspector-helpers";

describe("reference inspector helpers", () => {
  it("creates a new reference reference", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    const reference = createUniqueReferenceDraft(model);
    expect(reference.id).toBe("reference_1");
    expect(reference.source).toEqual({ type: "literal", value: "" });

    expect(addReferenceToModel(model, reference).references).toEqual([
      reference,
    ]);
  });

  it("formats reference syntax", () => {
    expect(getReferenceSyntax("revenue")).toBe("{{ .revenue }}");
  });

  it("appends references to text content with spacing", () => {
    expect(
      appendReferenceToInlineContent(
        [{ text: "Revenue:", type: "text" }],
        "revenue",
      ),
    ).toEqual([
      { text: "Revenue: ", type: "text" },
      { referenceId: "revenue", type: "reference" },
    ]);
  });

  it("adds and inserts a reference with one final model update", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Hello", type: "text" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    const reference = createUniqueReferenceDraft(model);
    const nextModel = addReferenceAndInsertIntoTextBlock({
      blockId: "text_1",
      model,
      reference,
    });

    expect(nextModel.references).toEqual([reference]);
    expect(nextModel.blocks[0]).toEqual({
      content: [
        { text: "Hello ", type: "text" },
        { referenceId: reference.id, type: "reference" },
      ],
      id: "text_1",
      type: "text",
    });
  });

  it("renames a reference and updates text references", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "revenue", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: "1200" },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    const result = renameReferenceInModel({
      model,
      nextReferenceId: "sales",
      previousReferenceId: "revenue",
    });

    expect(result.status).toBe("renamed");
    if (result.status !== "renamed") {
      throw new Error("Expected rename.");
    }

    expect(result.model.references[0]?.id).toBe("sales");
    expect(result.model.blocks[0]).toEqual({
      content: [{ referenceId: "sales", type: "reference" }],
      id: "text_1",
      type: "text",
    });
  });

  it("rejects duplicate reference names", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        {
          id: "one",
          source: { type: "literal", value: "" },
        },
        {
          id: "two",
          source: { type: "literal", value: "" },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      renameReferenceInModel({
        model,
        nextReferenceId: "two",
        previousReferenceId: "one",
      }),
    ).toEqual({
      message: "Reference id already exists.",
      status: "duplicate_name",
    });
  });

  it("rejects invalid reference names", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      renameReferenceInModel({
        model,
        nextReferenceId: "1bad",
        previousReferenceId: "one",
      }),
    ).toEqual({
      message:
        "Reference id must start with a letter and use letters, numbers, underscores, or hyphens.",
      status: "invalid_name",
    });
  });

  it("inserts an existing reference into a selected text block", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Hello", type: "text" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: "1200" },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    const result = insertReferenceIntoSelectedTextBlock({
      model,
      referenceId: "revenue",
      selection: { blockId: "text_1", type: "block" },
    });

    expect(result).not.toBeNull();
    expect(result?.blocks[0]).toEqual({
      content: [
        { text: "Hello ", type: "text" },
        { referenceId: "revenue", type: "reference" },
      ],
      id: "text_1",
      type: "text",
    });
  });

  it("does not insert a reference when the selected item is not a text block", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          id: "table_1",
          table: {
            cells: [],
            columns: [],
            prompt: "Prompt",
            responseFields: [],
            rows: [],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      insertReferenceIntoSelectedTextBlock({
        model,
        referenceId: "revenue",
        selection: { blockId: "table_1", type: "table" },
      }),
    ).toBeNull();
  });

  it("removes an unused reference", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: "1200" },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      removeUnusedReferenceFromModel({
        model,
        referenceId: "revenue",
      }),
    ).toEqual({
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    });
  });

  it("creates a reference draft from a source", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      createReferenceDraftFromSource({
        label: "Cell reference",
        model,
        source: { type: "literal", value: "x" },
      }),
    ).toEqual({
      id: "reference_1",
      label: "Cell reference",
      source: { type: "literal", value: "x" },
    });
  });
});
