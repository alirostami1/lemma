import { describe, expect, it } from "vitest";
import {
  normalizeWorkbookReferenceIdsInComposedEditorModel,
  parseInlineBlueprint,
} from "#/domains/questions/authoring";
import {
  formatReferenceToken,
  getWorkbookReferenceKeyForSource,
  normalizeWorkbookRefInput,
} from "./reference-keys";

describe("reference keys", () => {
  it("creates workbook reference ids for new workbook references", () => {
    const normalized = normalizeWorkbookRefInput({
      defaultSheetName: null,
      rawRef: "Sheet1!a1",
      sourceId: "source_1",
    });

    expect(normalized).toEqual({
      referenceId: "workbook:source_1:cell:Sheet1:A1",
      source: {
        ref: "Sheet1!A1",
        sourceId: "source_1",
        type: "workbook_cell",
      },
      status: "normalized",
    });
  });

  it("never creates excel ids for new workbook references", () => {
    const normalized = normalizeWorkbookRefInput({
      defaultSheetName: null,
      rawRef: "Sheet1!A1:B3",
      sourceId: "source_1",
    });

    expect(normalized.status).toBe("normalized");
    expect(
      normalized.status === "normalized" &&
        normalized.referenceId.startsWith("excel:"),
    ).toBe(false);
  });

  it("formats workbook tokens with bracket syntax", () => {
    expect(formatReferenceToken("workbook:source_1:cell:Sheet1:A1")).toBe(
      '{{ .["workbook:source_1:cell:Sheet1:A1"] }}',
    );
  });

  it("round-trips bracket workbook token syntax", () => {
    expect(
      parseInlineBlueprint(
        'Revenue {{ .["workbook:source_1:range:Sheet1:A1:B3"][1,2] }}',
      ),
    ).toEqual([
      { text: "Revenue ", type: "text" },
      {
        rangeCell: { columnOffset: 2, rowOffset: 1 },
        referenceId: "workbook:source_1:range:Sheet1:A1:B3",
        type: "reference",
      },
    ]);
  });

  it("normalizes old excel workbook ids from structured source", () => {
    const model = normalizeWorkbookReferenceIdsInComposedEditorModel({
      blocks: [
        {
          content: [
            { referenceId: "excel:source_1:Sheet1:A1", type: "reference" },
          ],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "excel:source_1:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    });

    expect(model.references[0]?.id).toBe("workbook:source_1:cell:Sheet1:A1");
    expect(model.blocks[0]).toEqual({
      content: [
        {
          referenceId: "workbook:source_1:cell:Sheet1:A1",
          type: "reference",
        },
      ],
      id: "text_1",
      type: "text",
    });
  });

  it("normalizes legacy reference_1 workbook ids from structured source", () => {
    const model = normalizeWorkbookReferenceIdsInComposedEditorModel({
      blocks: [
        {
          correctValueSource: {
            referenceId: "reference_1",
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [
        {
          id: "reference_1",
          source: {
            ref: "Sheet1!B2",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [{ id: "answer_1", type: "text" }],
      schemaVersion: 1,
    });

    expect(model.references[0]?.id).toBe("workbook:source_1:cell:Sheet1:B2");
    expect(model.blocks[0]).toEqual({
      correctValueSource: {
        referenceId: "workbook:source_1:cell:Sheet1:B2",
        type: "reference",
      },
      grading: { mode: "exact" },
      id: "response_1",
      points: 1,
      responseFieldId: "answer_1",
      type: "response",
    });
  });

  it("merges duplicate canonical workbook references deterministically", () => {
    const canonicalId = getWorkbookReferenceKeyForSource({
      ref: "Sheet1!A1",
      sourceId: "source_1",
      type: "workbook_cell",
    });

    const model = normalizeWorkbookReferenceIdsInComposedEditorModel({
      blocks: [
        {
          content: [
            { referenceId: "excel:source_1:Sheet1:A1", type: "reference" },
          ],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "excel:source_1:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
        {
          id: canonicalId ?? "fallback",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    });

    expect(model.references).toHaveLength(1);
    expect(model.references[0]?.id).toBe("workbook:source_1:cell:Sheet1:A1");
    expect(model.blocks[0]).toEqual({
      content: [
        {
          referenceId: "workbook:source_1:cell:Sheet1:A1",
          type: "reference",
        },
      ],
      id: "text_1",
      type: "text",
    });
  });
});
