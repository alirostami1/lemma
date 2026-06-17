import type { ZipEntry } from "../domain.js";

export function collectForbiddenEntryFindings(entries: ZipEntry[]): string[] {
  const findings: string[] = [];
  for (const entry of entries) {
    const lowerName = entry.name.toLowerCase();
    if (
      lowerName === "xl/vbaproject.bin" ||
      lowerName.endsWith("/vbaproject.bin")
    ) {
      findings.push("macros_vba");
    }
    if (lowerName.startsWith("xl/externallinks/")) {
      findings.push("external_workbook_links");
    }
    if (
      lowerName === "xl/connections.xml" ||
      lowerName.startsWith("xl/connections/")
    ) {
      findings.push("data_connections");
    }
    if (
      lowerName.startsWith("xl/embeddings/") ||
      lowerName.includes("activex")
    ) {
      findings.push("ole_or_activex");
    }
    if (lowerName === "encryptedpackage") {
      findings.push("encrypted_workbook");
    }
  }
  return uniqueFindings(findings);
}

export function collectWorkbookXmlFindings(xml: string): string[] {
  const findings: string[] = [];
  if (/<workbookProtection(?:\s|>)/i.test(xml)) {
    findings.push("workbook_protection");
  }
  return findings;
}

export function collectWorksheetXmlFindings(xml: string): string[] {
  const findings: string[] = [];
  if (/<sheetProtection(?:\s|>)/i.test(xml)) {
    findings.push("sheet_protection");
  }
  if (/<queryTable(?:\s|>)/i.test(xml)) {
    findings.push("data_connections");
  }
  return findings;
}

export function collectRelationshipXmlFindings(
  partName: string,
  xml: string,
): string[] {
  if (/TargetMode\s*=\s*["']External["']/i.test(xml)) {
    return [`external_relationship:${partName}`];
  }
  return [];
}

export function uniqueFindings(findings: string[]): string[] {
  return [...new Set(findings)];
}
