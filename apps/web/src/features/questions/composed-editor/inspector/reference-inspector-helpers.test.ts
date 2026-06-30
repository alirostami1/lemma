import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  addReferenceToModel,
  createUniqueReferenceDraft,
} from "./reference-inspector-helpers";

describe("reference inspector helpers", () => {
  it("creates a new reference reference", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const reference = createUniqueReferenceDraft(model);
    expect(reference.id).toBe("reference_1");
    expect(reference.source).toEqual({ type: "literal", value: "" });

    expect(addReferenceToModel(model, reference).references).toEqual([
      reference,
    ]);
  });
});
