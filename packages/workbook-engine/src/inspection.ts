import { readFile } from "node:fs/promises";
import { openXlsxZipContainer } from "./container/zip.js";
import type { WorkbookEngineConfig, WorkbookInspection } from "./domain.js";
import { InvalidWorkbookError } from "./domain.js";
import {
  collectForbiddenEntryFindings,
  collectRelationshipXmlFindings,
  collectWorkbookXmlFindings,
  collectWorksheetXmlFindings,
  uniqueFindings,
} from "./security/policy.js";

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

export async function inspectXlsx(
  path: string,
  config: WorkbookEngineConfig,
): Promise<WorkbookInspection> {
  const buffer = await readFile(path);
  if (
    config.maxFileBytes !== undefined &&
    buffer.length > config.maxFileBytes
  ) {
    throw new InvalidWorkbookError("Workbook file is too large.", {
      sheetCount: 0,
      cellCount: 0,
      formulaCount: 0,
      forbiddenFeatureFindings: ["file_too_large"],
    });
  }

  const container = openXlsxZipContainer(buffer, config);
  const findings = collectForbiddenEntryFindings(container.entries);
  const workbookEntry = container.byName.get("xl/workbook.xml");
  if (!container.byName.has("[Content_Types].xml") || !workbookEntry) {
    throw new InvalidWorkbookError("Workbook must be an .xlsx file.", {
      sheetCount: 0,
      cellCount: 0,
      formulaCount: 0,
      forbiddenFeatureFindings: ["not_xlsx"],
    });
  }

  findings.push(
    ...collectWorkbookXmlFindings(
      await readBoundedXmlPart({
        partName: workbookEntry.name,
        read: () => container.readTextEntry(workbookEntry),
        config,
      }),
    ),
  );

  let sheetCount = 0;
  let cellCount = 0;
  let formulaCount = 0;
  for (const entry of container.entries) {
    if (entry.name.endsWith(".rels")) {
      const xml = await readBoundedXmlPart({
        partName: entry.name,
        read: () => container.readTextEntry(entry),
        config,
      });
      findings.push(...collectRelationshipXmlFindings(entry.name, xml));
    }
    if (
      entry.name.startsWith("xl/worksheets/") &&
      entry.name.endsWith(".xml")
    ) {
      const xml = await readBoundedXmlPart({
        partName: entry.name,
        read: () => container.readTextEntry(entry),
        config,
      });
      findings.push(...collectWorksheetXmlFindings(xml));
      sheetCount += 1;
      cellCount += countMatches(xml, /<c(?:\s|>)/g);
      formulaCount += countMatches(xml, /<f(?:\s|>)/g);
    }
  }

  const inspection = {
    sheetCount,
    cellCount,
    formulaCount,
    forbiddenFeatureFindings: uniqueFindings(findings),
  };
  rejectInvalidInspection(inspection, config);
  return inspection;
}

async function readBoundedXmlPart(input: {
  partName: string;
  read(): Promise<string>;
  config: WorkbookEngineConfig;
}) {
  const xml = await input.read();
  if (
    Buffer.byteLength(xml, "utf8") > (input.config.maxXmlPartBytes ?? 5_000_000)
  ) {
    throw new InvalidWorkbookError(
      `Workbook XML part is too large: ${input.partName}`,
      {
        sheetCount: 0,
        cellCount: 0,
        formulaCount: 0,
        forbiddenFeatureFindings: ["xml_part_too_large"],
      },
    );
  }
  return xml;
}

function rejectInvalidInspection(
  inspection: WorkbookInspection,
  config: WorkbookEngineConfig,
) {
  if (inspection.sheetCount > config.maxSheets) {
    throw new InvalidWorkbookError("Workbook has too many sheets.", {
      ...inspection,
      forbiddenFeatureFindings: [
        ...inspection.forbiddenFeatureFindings,
        "too_many_sheets",
      ],
    });
  }
  if (inspection.cellCount > config.maxCells) {
    throw new InvalidWorkbookError("Workbook has too many cells.", {
      ...inspection,
      forbiddenFeatureFindings: [
        ...inspection.forbiddenFeatureFindings,
        "too_many_cells",
      ],
    });
  }
  if (inspection.formulaCount > config.maxFormulas) {
    throw new InvalidWorkbookError("Workbook has too many formulas.", {
      ...inspection,
      forbiddenFeatureFindings: [
        ...inspection.forbiddenFeatureFindings,
        "too_many_formulas",
      ],
    });
  }
  if (inspection.forbiddenFeatureFindings.length > 0) {
    throw new InvalidWorkbookError(
      "Workbook contains unsafe features.",
      inspection,
    );
  }
}
