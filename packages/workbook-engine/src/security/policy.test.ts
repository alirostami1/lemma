import { describe, expect, it } from "vitest";
import type { ZipEntry } from "../domain.js";
import {
  collectForbiddenEntryFindings,
  collectRelationshipXmlFindings,
  collectWorkbookXmlFindings,
  collectWorksheetXmlFindings,
  collectXmlSafetyFindings,
} from "./policy.js";

describe("workbook security policy", () => {
  it("finds forbidden package parts", () => {
    expect(
      collectForbiddenEntryFindings([
        entry("xl/vbaProject.bin"),
        entry("xl/externalLinks/externalLink1.xml"),
        entry("xl/embeddings/oleObject1.bin"),
      ]),
    ).toEqual(["macros_vba", "external_workbook_links", "ole_or_activex"]);
  });

  it("finds protected workbook and worksheet XML", () => {
    expect(collectWorkbookXmlFindings("<workbookProtection />")).toEqual([
      "workbook_protection",
    ]);
    expect(collectWorksheetXmlFindings("<sheetProtection />")).toEqual([
      "sheet_protection",
    ]);
  });

  it("finds external relationships with the part name", () => {
    expect(
      collectRelationshipXmlFindings(
        "xl/_rels/workbook.xml.rels",
        '<Relationship TargetMode="External" />',
      ),
    ).toEqual(["external_relationship:xl/_rels/workbook.xml.rels"]);
  });

  it("rejects XML document type and entity declarations", () => {
    expect(collectXmlSafetyFindings("<!DOCTYPE workbook>")).toEqual([
      "xml_external_entity",
    ]);
    expect(
      collectXmlSafetyFindings("<!ENTITY xxe SYSTEM 'file:///etc/passwd'>"),
    ).toEqual(["xml_external_entity"]);
  });
});

function entry(name: string): ZipEntry {
  return {
    compressedSize: 0,
    method: 0,
    name,
    offset: 0,
    uncompressedSize: 0,
  };
}
