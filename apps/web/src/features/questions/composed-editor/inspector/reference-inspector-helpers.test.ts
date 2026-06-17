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
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [],
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
        [{ type: "text", text: "Revenue:" }],
        "revenue",
      ),
    ).toEqual([
      { type: "text", text: "Revenue: " },
      { type: "reference", referenceId: "revenue" },
    ]);
  });

  it("adds and inserts a reference with one final model update", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
      responseFields: [],
      references: [],
    };

    const reference = createUniqueReferenceDraft(model);
    const nextModel = addReferenceAndInsertIntoTextBlock({
      model,
      blockId: "text_1",
      reference,
    });

    expect(nextModel.references).toEqual([reference]);
    expect(nextModel.blocks[0]).toEqual({
      id: "text_1",
      type: "text",
      content: [
        { type: "text", text: "Hello " },
        { type: "reference", referenceId: reference.id },
      ],
    });
  });

  it("renames a reference and updates text references", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "revenue" }],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: "1200" },
        },
      ],
    };

    const result = renameReferenceInModel({
      model,
      previousReferenceId: "revenue",
      nextReferenceId: "sales",
    });

    expect(result.status).toBe("renamed");
    if (result.status !== "renamed") {
      throw new Error("Expected rename.");
    }

    expect(result.model.references[0]?.id).toBe("sales");
    expect(result.model.blocks[0]).toEqual({
      id: "text_1",
      type: "text",
      content: [{ type: "reference", referenceId: "sales" }],
    });
  });

  it("rejects duplicate reference names", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
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
    };

    expect(
      renameReferenceInModel({
        model,
        previousReferenceId: "one",
        nextReferenceId: "two",
      }),
    ).toEqual({
      status: "duplicate_name",
      message: "Reference id already exists.",
    });
  });

  it("rejects invalid reference names", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [],
    };

    expect(
      renameReferenceInModel({
        model,
        previousReferenceId: "one",
        nextReferenceId: "1bad",
      }),
    ).toEqual({
      status: "invalid_name",
      message:
        "Reference id must start with a letter and use letters, numbers, underscores, or hyphens.",
    });
  });

  it("inserts an existing reference into a selected text block", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: "1200" },
        },
      ],
    };

    const result = insertReferenceIntoSelectedTextBlock({
      model,
      selection: { type: "block", blockId: "text_1" },
      referenceId: "revenue",
    });

    expect(result).not.toBeNull();
    expect(result?.blocks[0]).toEqual({
      id: "text_1",
      type: "text",
      content: [
        { type: "text", text: "Hello " },
        { type: "reference", referenceId: "revenue" },
      ],
    });
  });

  it("does not insert a reference when the selected item is not a text block", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "table_1",
          type: "table",
          table: {
            prompt: "Prompt",
            columns: [],
            rows: [],
            showColumnNames: true,
            showRowNames: true,
            responseFields: [],
            cells: [],
          },
        },
      ],
      responseFields: [],
      references: [],
    };

    expect(
      insertReferenceIntoSelectedTextBlock({
        model,
        selection: { type: "table", blockId: "table_1" },
        referenceId: "revenue",
      }),
    ).toBeNull();
  });

  it("removes an unused reference", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: "1200" },
        },
      ],
    };

    expect(
      removeUnusedReferenceFromModel({
        model,
        referenceId: "revenue",
      }),
    ).toEqual({
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [],
    });
  });

  it("creates a reference draft from a source", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [],
    };

    expect(
      createReferenceDraftFromSource({
        model,
        source: { type: "literal", value: "x" },
        label: "Cell reference",
      }),
    ).toEqual({
      id: "reference_1",
      source: { type: "literal", value: "x" },
      label: "Cell reference",
    });
  });
});
