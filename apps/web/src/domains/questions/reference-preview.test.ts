import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  formatReferenceFallback,
  resolveInlineReferencePreview,
  resolveReferencePreviewValues,
  resolveValueExpressionPreview,
} from "./reference-preview";

const now = 123;

describe("reference preview cache", () => {
  it("resolves literal references", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 1200 },
        },
      ],
    };

    expect(
      resolveReferencePreviewValues({
        model,
        workbookPreview: null,
        activeSourceId: null,
        now,
      }),
    ).toEqual({
      revenue: {
        referenceId: "revenue",
        status: "resolved",
        displayValue: "1200",
        rawValue: 1200,
        updatedAt: now,
      },
    });
  });

  it("resolves workbook references from normalized selected refs", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [
        {
          id: "score",
          source: {
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "Sheet1!a1",
          },
        },
      ],
    };

    expect(
      resolveReferencePreviewValues({
        model,
        workbookPreview: null,
        activeSourceId: "source_1",
        workbookSelectionValuesByRef: {
          "'Sheet1'!A1:A1": [["90"]],
        },
        now,
      }),
    ).toMatchObject({
      score: {
        status: "resolved",
        displayValue: "90",
        rawValue: "90",
      },
    });
  });

  it("formats fallback references", () => {
    expect(formatReferenceFallback("revenue")).toBe("{{ .revenue }}");
  });

  it("formats range cell fallback references", () => {
    expect(
      formatReferenceFallback("revenue_range", {
        rowOffset: 1,
        columnOffset: 2,
      }),
    ).toBe("{{ .revenue_range[1,2] }}");
  });

  it("resolves range cell inline references from range previews", () => {
    expect(
      resolveInlineReferencePreview({
        referenceId: "revenue_range",
        rangeCell: { rowOffset: 1, columnOffset: 0 },
        referencePreviewCache: {
          revenue_range: {
            referenceId: "revenue_range",
            status: "resolved",
            displayValue: "Q1, Q2",
            rawValue: [
              ["Q1", "100"],
              ["Q2", "200"],
            ],
            updatedAt: now,
          },
        },
        now,
      }),
    ).toEqual({
      referenceId: "revenue_range",
      status: "resolved",
      displayValue: "Q2",
      rawValue: "Q2",
      updatedAt: now,
    });
  });

  it("resolves literal value expressions without a reference", () => {
    expect(
      resolveValueExpressionPreview({
        value: { type: "literal", value: "Alpha" },
        referencePreviewCache: {},
        now,
      }),
    ).toEqual({
      status: "literal",
      displayValue: "Alpha",
      rawValue: "Alpha",
    });
  });
});
