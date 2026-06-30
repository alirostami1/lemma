import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractInlineBlueprintReferences,
  formatInlineBlueprintReference,
  formatInlineBlueprintReferenceToken,
  formatInlineBlueprintText,
  type InlineBlueprintContent,
  isSimpleInlineBlueprintReferenceId,
  parseInlineBlueprintText,
} from "./index.js";

describe("inline blueprint syntax", () => {
  it("parses plain text", () => {
    assert.deepEqual(parseInlineBlueprintText("Revenue"), [
      { text: "Revenue", type: "text" },
    ]);
  });

  it("parses simple references", () => {
    assert.deepEqual(parseInlineBlueprintText("Revenue: {{ .revenue }}"), [
      { text: "Revenue: ", type: "text" },
      { referenceId: "revenue", type: "reference" },
    ]);
  });

  it("parses multiple references", () => {
    assert.deepEqual(
      parseInlineBlueprintText("{{ .first }} and {{ .second }}"),
      [
        { referenceId: "first", type: "reference" },
        { text: " and ", type: "text" },
        { referenceId: "second", type: "reference" },
      ],
    );
  });

  it("parses bracketed reference ids", () => {
    assert.deepEqual(
      parseInlineBlueprintText('Value {{ .["workbook:source:cell"] }}'),
      [
        { text: "Value ", type: "text" },
        {
          referenceId: "workbook:source:cell",
          type: "reference",
        },
      ],
    );
  });

  it("parses escaped quotes and backslashes in bracketed reference ids", () => {
    assert.deepEqual(
      parseInlineBlueprintText(
        'Value {{ .["workbook:\\"source\\\\1\\":cell"] }}',
      ),
      [
        { text: "Value ", type: "text" },
        {
          referenceId: 'workbook:"source\\1":cell',
          type: "reference",
        },
      ],
    );
  });

  it("parses rangeCell offsets", () => {
    assert.deepEqual(
      extractInlineBlueprintReferences(
        'Cell {{ .["workbook:source_1:range:Sheet1:A1:B3"][1,2] }}',
      ),
      [
        {
          rangeCell: { columnOffset: 2, rowOffset: 1 },
          referenceId: "workbook:source_1:range:Sheet1:A1:B3",
          type: "reference",
        },
      ],
    );
  });

  it("keeps malformed reference tokens as text", () => {
    assert.deepEqual(parseInlineBlueprintText("Value {{ .range[1] }}"), [
      { text: "Value {{ .range[1] }}", type: "text" },
    ]);
  });

  it("formats simple references", () => {
    assert.equal(
      formatInlineBlueprintReference({
        referenceId: "revenue",
        type: "reference",
      }),
      "{{ .revenue }}",
    );
  });

  it("formats bracketed reference ids", () => {
    assert.equal(
      formatInlineBlueprintReferenceToken("workbook:source_1:cell:Sheet1:A1"),
      '{{ .["workbook:source_1:cell:Sheet1:A1"] }}',
    );
  });

  it("formats escaped quoted reference ids", () => {
    assert.equal(
      formatInlineBlueprintReferenceToken('workbook:"source\\1":cell'),
      '{{ .["workbook:\\"source\\\\1\\":cell"] }}',
    );
  });

  it("formats rangeCell references", () => {
    assert.equal(
      formatInlineBlueprintReference({
        rangeCell: { columnOffset: 2, rowOffset: 1 },
        referenceId: "workbook:source_1:range:Sheet1:A1:B3",
        type: "reference",
      }),
      '{{ .["workbook:source_1:range:Sheet1:A1:B3"][1,2] }}',
    );
  });

  it("round-trips parse(format(content))", () => {
    const content: InlineBlueprintContent[] = [
      { text: "Revenue ", type: "text" },
      { referenceId: "simple", type: "reference" },
      { text: " and ", type: "text" },
      {
        rangeCell: { columnOffset: 1, rowOffset: 0 },
        referenceId: "workbook:source_1:range:Sheet1:A1:B3",
        type: "reference",
      },
    ];

    assert.deepEqual(
      parseInlineBlueprintText(formatInlineBlueprintText(content)),
      content,
    );
  });

  it("extracts references only", () => {
    assert.deepEqual(extractInlineBlueprintReferences("A {{ .one }} B"), [
      { referenceId: "one", type: "reference" },
    ]);
  });

  it("identifies simple reference ids", () => {
    assert.equal(isSimpleInlineBlueprintReferenceId("revenue_1"), true);
    assert.equal(
      isSimpleInlineBlueprintReferenceId("workbook:source:cell"),
      false,
    );
  });
});
