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
      blocks: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 1200 },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      resolveReferencePreviewValues({
        model,
        now,
      }),
    ).toEqual({
      revenue: {
        displayValue: "1200",
        rawValue: 1200,
        referenceId: "revenue",
        status: "resolved",
        updatedAt: now,
      },
    });
  });

  it("resolves workbook references from normalized selected refs", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        {
          id: "score",
          source: {
            ref: "Sheet1!a1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(
      resolveReferencePreviewValues({
        model,
        now,
        workbookSelectionValuesBySourceAndRef: {
          "source_1::'Sheet1'!A1": [["90"]],
        },
      }),
    ).toMatchObject({
      score: {
        displayValue: "90",
        rawValue: "90",
        status: "resolved",
      },
    });
  });

  it("formats fallback references", () => {
    expect(formatReferenceFallback("revenue")).toBe("{{ .revenue }}");
  });

  it("formats range cell fallback references", () => {
    expect(
      formatReferenceFallback("revenue_range", {
        columnOffset: 2,
        rowOffset: 1,
      }),
    ).toBe("{{ .revenue_range[1,2] }}");
  });

  it("resolves range cell inline references from range previews", () => {
    expect(
      resolveInlineReferencePreview({
        now,
        rangeCell: { columnOffset: 0, rowOffset: 1 },
        referenceId: "revenue_range",
        referencePreviewCache: {
          revenue_range: {
            displayValue: "Q1, Q2",
            rawValue: [
              ["Q1", "100"],
              ["Q2", "200"],
            ],
            referenceId: "revenue_range",
            status: "resolved",
            updatedAt: now,
          },
        },
      }),
    ).toEqual({
      displayValue: "Q2",
      rawValue: "Q2",
      referenceId: "revenue_range",
      status: "resolved",
      updatedAt: now,
    });
  });

  it("resolves literal value expressions without a reference", () => {
    expect(
      resolveValueExpressionPreview({
        now,
        referencePreviewCache: {},
        value: { type: "literal", value: "Alpha" },
      }),
    ).toEqual({
      displayValue: "Alpha",
      rawValue: "Alpha",
      status: "literal",
    });
  });
});
