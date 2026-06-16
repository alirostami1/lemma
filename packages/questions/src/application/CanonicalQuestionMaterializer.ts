import type { JsonValue } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import {
  type QuestionBody,
  type QuestionFieldRule,
  type QuestionSolution,
  type QuestionSourcePlan,
  type QuestionBlueprintDocument,
  type QuestionBlueprintResponseBlock,
  type QuestionBlueprintTableCell,
  type QuestionReferenceSource,
  type QuestionValueExpression,
  type RenderedInlineContent,
  type BlueprintInlineContent,
  type RangeCellOffset,
  type WorkbookSnapshotId,
} from "../domain/index.js";
import {
  InvalidQuestionBlueprintError,
  WorkbookQuestionSourceError,
} from "./errors.js";
import type { QuestionValueResolverPort } from "./ports.js";

const instrumentation = instrumentService("questions", "canonical_materializer");

export class CanonicalQuestionMaterializer {
  constructor(private readonly valueResolver: QuestionValueResolverPort) {}

  async materialize(input: {
    document: QuestionBlueprintDocument;
    workbookSnapshotId?: WorkbookSnapshotId | null;
    currentUser?: CurrentUser;
  }): Promise<{
    body: QuestionBody;
    solution: QuestionSolution;
    sourcePlan: QuestionSourcePlan;
  }> {
    return instrumentation.run(
      "materialize",
      {
        attributes: {
          "questions.blueprint.blocks": input.document.blocks.length,
          "questions.blueprint.references": input.document.references.length,
        },
      },
      () => this.materializeInternal(input),
    );
  }

  private async materializeInternal(input: {
    document: QuestionBlueprintDocument;
    workbookSnapshotId?: WorkbookSnapshotId | null;
    currentUser?: CurrentUser;
  }): Promise<{
    body: QuestionBody;
    solution: QuestionSolution;
    sourcePlan: QuestionSourcePlan;
  }> {
    const referenceValues = new Map<string, JsonValue>();
    const sourceReferences: QuestionSourcePlan["references"] = [];
    const rules: QuestionFieldRule[] = [];

    for (const reference of input.document.references) {
      const value = await this.resolveReference(input, reference.source);
      referenceValues.set(reference.id, value);
      sourceReferences.push({ id: reference.id, source: reference.source, resolved: true });
    }

    const blocks = await Promise.all(
      input.document.blocks.map(async (block) => {
        if (block.type === "text") {
          return {
            ...block,
            content: renderInline(block.content, referenceValues),
          };
        }
        if (block.type === "rich_text" || block.type === "separator") {
          return block;
        }
        if (block.type === "response") {
          this.addRule(rules, block, referenceValues);
          return {
            id: block.id,
            type: block.type,
            responseFieldId: block.responseFieldId,
            ...(block.label === undefined ? {} : { label: block.label }),
            ...(block.placeholder === undefined
              ? {}
              : { placeholder: block.placeholder }),
          };
        }
        const cells = await Promise.all(
          block.cells.map(async (cell) => {
            if (cell.type === "content") {
              return {
                id: cell.id,
                rowId: cell.rowId,
                columnId: cell.columnId,
                type: "content" as const,
                text: renderPlainText(cell.content, referenceValues),
              };
            }
            this.addRule(rules, cell, referenceValues);
            return {
              id: cell.id,
              rowId: cell.rowId,
              columnId: cell.columnId,
              type: cell.type,
              responseFieldId: cell.responseFieldId,
              ...(cell.label === undefined ? {} : { label: cell.label }),
              ...(cell.placeholder === undefined
                ? {}
                : { placeholder: cell.placeholder }),
            };
          }),
        );
        return { ...block, cells };
      }),
    );

    return {
      body: {
        schemaVersion: 1,
        blocks,
        responseFields: input.document.responseFields,
      },
      solution: { schemaVersion: 1, rules },
      sourcePlan: { schemaVersion: 1, references: sourceReferences },
    };
  }

  private resolveReference(
    input: {
      workbookSnapshotId?: WorkbookSnapshotId | null;
      currentUser?: CurrentUser;
    },
    source: QuestionReferenceSource,
  ) {
    if (source.type === "literal") {
      return source.value;
    }
    if (!input.workbookSnapshotId) {
      throw new WorkbookQuestionSourceError(
        "workbook references require a workbook snapshot",
      );
    }
    return this.valueResolver.resolveReference({
      currentUser: input.currentUser,
      workbookSnapshotId: input.workbookSnapshotId,
      source,
    });
  }

  private addRule(
    rules: QuestionFieldRule[],
    block: QuestionBlueprintResponseBlock | Extract<QuestionBlueprintTableCell, { type: "response" }>,
    referenceValues: ReadonlyMap<string, JsonValue>,
  ) {
    if (block.grading.mode === "manual") {
      rules.push({
        type: "manual",
        responseFieldId: block.responseFieldId,
        points: block.points,
      });
      return;
    }
    if (!block.correctValueSource) {
      throw new InvalidQuestionBlueprintError(
        "non-manual response grading requires correctValueSource",
      );
    }
    const correctValue = resolveQuestionValue(block.correctValueSource, referenceValues);
    rules.push(toRule(block.responseFieldId, correctValue, block));
  }
}

function toRule(
  responseFieldId: string,
  correctValue: JsonValue,
  block: QuestionBlueprintResponseBlock | Extract<QuestionBlueprintTableCell, { type: "response" }>,
): QuestionFieldRule {
  if (block.grading.mode === "number") {
    const numericCorrectValue = Number(correctValue);
    if (!Number.isFinite(numericCorrectValue)) {
      throw new InvalidQuestionBlueprintError(
        "number grading requires a numeric correct value",
      );
    }
    return {
      type: "number",
      responseFieldId,
      correctValue: numericCorrectValue,
      points: block.points,
      tolerance: block.grading.tolerance,
    };
  }
  if (block.grading.mode === "case_insensitive_text") {
    return {
      type: "case_insensitive_text",
      responseFieldId,
      correctValue: String(correctValue),
      points: block.points,
    };
  }
  return {
    type: "exact",
    responseFieldId,
    correctValue,
    points: block.points,
  };
}

function renderInline(
  content: BlueprintInlineContent[],
  referenceValues: ReadonlyMap<string, JsonValue>,
): RenderedInlineContent[] {
  return content.map((part) => {
    if (part.type === "text") {
      return part;
    }
    return {
      type: "value",
      referenceId: part.referenceId,
      displayValue: displayValue(
        inlineReferenceValue(part, referenceValues) ?? part.fallbackText ?? "",
      ),
    };
  });
}

function renderPlainText(
  content: BlueprintInlineContent[],
  referenceValues: ReadonlyMap<string, JsonValue>,
): string {
  return content
    .map((part) =>
      part.type === "text"
        ? part.text
        : displayValue(
            inlineReferenceValue(part, referenceValues) ??
              part.fallbackText ??
              "",
          ),
    )
    .join("");
}

function inlineReferenceValue(
  part: Extract<BlueprintInlineContent, { type: "reference" }>,
  referenceValues: ReadonlyMap<string, JsonValue>,
): JsonValue | undefined {
  const value = referenceValues.get(part.referenceId);
  if (!part.rangeCell || value === undefined) {
    return value;
  }
  return rangeCellValue(value, part.rangeCell);
}

function rangeCellValue(
  value: JsonValue,
  rangeCell: RangeCellOffset,
): JsonValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const row = value[rangeCell.rowOffset];
  if (!Array.isArray(row)) {
    return undefined;
  }
  return row[rangeCell.columnOffset];
}

function displayValue(value: JsonValue | string) {
  return value == null ? "" : String(value);
}

function resolveQuestionValue(
  source: QuestionValueExpression,
  referenceValues: ReadonlyMap<string, JsonValue>,
): JsonValue {
  if (source.type === "literal") {
    return source.value;
  }

  return referenceValues.get(source.referenceId) ?? null;
}
