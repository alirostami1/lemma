import type { JsonValue } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import type {
  BlueprintInlineContent,
  QuestionBlueprintDocument,
  QuestionBlueprintInputBlock,
  QuestionBlueprintPrimitiveBlock,
  QuestionBlueprintSource,
  QuestionBody,
  QuestionFieldRule,
  QuestionPrimitiveBlock,
  QuestionReferenceSource,
  QuestionSolution,
  QuestionSourceEvidence,
  QuestionSourcePlan,
  QuestionValueExpression,
  RangeCellOffset,
  RenderedInlineContent,
  RichContent,
  RichContentNode,
  RichListItemNode,
  RichTextNode,
} from "../domain/index.js";
import { materializeQuestionInputPrimitive } from "../domain/index.js";
import {
  InvalidQuestionBlueprintError,
  WorkbookQuestionReferenceError,
} from "./errors.js";
import type {
  QuestionValueResolverPort,
  WorkbookSnapshotForQuestionGeneration,
} from "./ports.js";

const instrumentation = instrumentService(
  "questions",
  "canonical_materializer",
);

export class CanonicalQuestionMaterializer {
  constructor(private readonly valueResolver: QuestionValueResolverPort) {}

  async materialize(input: {
    document: QuestionBlueprintDocument;
    sources: readonly QuestionBlueprintSource[];
    generationRunId: string;
    questionIndex: number;
    workbookCalculationId?: string | null;
    sourceLineageBySourceId?: ReadonlyMap<
      string,
      WorkbookSnapshotForQuestionGeneration
    >;
    currentUser?: CurrentUser;
  }): Promise<{
    body: QuestionBody;
    solution: QuestionSolution;
    sourceEvidence: QuestionSourceEvidence;
    sourcePlan: QuestionSourcePlan;
  }> {
    return instrumentation.run(
      "materialize",
      {
        attributes: {
          "questions.blueprint.blocks": input.document.blocks.length,
          "questions.blueprint.references": input.document.references.length,
          "questions.generation_run.id": input.generationRunId,
          "questions.generation_run.question_index": input.questionIndex,
        },
      },
      () => this.materializeInternal(input),
    );
  }

  private async materializeInternal(input: {
    document: QuestionBlueprintDocument;
    sources: readonly QuestionBlueprintSource[];
    questionIndex: number;
    workbookCalculationId?: string | null;
    sourceLineageBySourceId?: ReadonlyMap<
      string,
      WorkbookSnapshotForQuestionGeneration
    >;
    currentUser?: CurrentUser;
  }): Promise<{
    body: QuestionBody;
    solution: QuestionSolution;
    sourceEvidence: QuestionSourceEvidence;
    sourcePlan: QuestionSourcePlan;
  }> {
    const referenceValues = new Map<string, JsonValue>();
    const rules: QuestionFieldRule[] = [];
    const referenceIdsBySourceId = new Map<string, string[]>();
    const sourcePlanReferences: Array<
      QuestionSourcePlan["references"][number]
    > = [];

    for (const reference of input.document.references) {
      const resolution = await this.resolveReference(input, reference.source);
      referenceValues.set(reference.id, resolution.resolvedValue);
      if (resolution.sourceId !== undefined) {
        const referenceIds =
          referenceIdsBySourceId.get(resolution.sourceId) ?? [];
        referenceIds.push(reference.id);
        referenceIdsBySourceId.set(resolution.sourceId, referenceIds);
      }
      sourcePlanReferences.push({
        referenceId: reference.id,
        ...(resolution.sourceId ? { sourceId: resolution.sourceId } : {}),
        ...(resolution.ref ? { ref: resolution.ref } : {}),
        ...(resolution.workbookSnapshotId
          ? { workbookSnapshotId: resolution.workbookSnapshotId }
          : {}),
        value: resolution.resolvedValue,
      });
    }

    const blocks = input.document.blocks.map((block) =>
      this.materializeBlock(block, referenceValues, rules),
    );

    return {
      body: {
        blocks,
        responseFields: input.document.responseFields,
        schemaVersion: 2,
      },
      solution: { rules, schemaVersion: 1 },
      sourceEvidence: {
        schemaVersion: 1,
        sources: input.sources.flatMap((source) => {
          const lineage = input.sourceLineageBySourceId?.get(source.sourceId);
          const references = referenceIdsBySourceId.get(source.sourceId) ?? [];
          if (
            !lineage ||
            !input.workbookCalculationId ||
            references.length === 0
          ) {
            return [];
          }
          return [
            {
              questionIndex: lineage.questionIndex,
              references,
              snapshotIndex: lineage.snapshotIndex,
              sourceId: source.sourceId,
              sourceName: source.name,
              workbookCalculationId: input.workbookCalculationId,
              workbookId: lineage.workbookId,
              workbookSnapshotId: lineage.id,
            },
          ];
        }),
      },
      sourcePlan: {
        references: sourcePlanReferences,
        schemaVersion: 1,
      },
    };
  }

  private materializeBlock(
    block: QuestionBlueprintDocument["blocks"][number],
    referenceValues: ReadonlyMap<string, JsonValue>,
    rules: QuestionSolution["rules"],
  ): QuestionBody["blocks"][number] {
    if (block.kind === "container") {
      return {
        ...block,
        blocks: block.blocks.map((childBlock) =>
          this.materializeBlock(childBlock, referenceValues, rules),
        ),
      };
    }
    if (block.kind === "complex") {
      return {
        ...block,
        cells: block.cells.map((cell) => ({
          ...cell,
          blocks: cell.blocks.map((cellBlock) =>
            this.materializePrimitiveBlock(cellBlock, referenceValues, rules),
          ),
        })),
      };
    }
    return this.materializePrimitiveBlock(block, referenceValues, rules);
  }

  private materializePrimitiveBlock(
    block: QuestionBlueprintPrimitiveBlock,
    referenceValues: ReadonlyMap<string, JsonValue>,
    rules: QuestionSolution["rules"],
  ): QuestionPrimitiveBlock {
    if (block.type === "text") {
      return {
        ...block,
        content: renderInline(block.content, referenceValues),
      };
    }
    if (block.type === "rich_text") {
      return {
        ...block,
        content: renderRichContent(block.content, referenceValues),
      };
    }
    if (block.type === "separator") {
      return block;
    }
    this.addRule(rules, block, referenceValues);
    const input = materializeQuestionInputPrimitive(
      block.input,
      (source) => resolveQuestionValue(source, referenceValues),
      (message) => {
        throw new InvalidQuestionBlueprintError(message);
      },
    );
    return {
      id: block.id,
      input,
      kind: "primitive",
      responseFieldId: block.responseFieldId,
      type: "input",
      ...(block.label === undefined ? {} : { label: block.label }),
      ...(block.placeholder === undefined
        ? {}
        : { placeholder: block.placeholder }),
    };
  }

  private async resolveReference(
    input: {
      sourceLineageBySourceId?: ReadonlyMap<
        string,
        WorkbookSnapshotForQuestionGeneration
      >;
      currentUser?: CurrentUser;
    },
    source: QuestionReferenceSource,
  ): Promise<{
    resolvedValue: JsonValue;
    sourceId?: string;
    ref?: string;
    workbookSnapshotId?: string;
  }> {
    if (source.type === "literal") {
      return { resolvedValue: source.value };
    }
    const lineage = input.sourceLineageBySourceId?.get(source.sourceId);
    if (!lineage) {
      throw new WorkbookQuestionReferenceError(
        "workbook references require a workbook snapshot",
      );
    }
    const resolvedValue = await this.valueResolver.resolveReference({
      currentUser: input.currentUser,
      source,
      workbookSnapshotId: lineage.id,
    });
    return {
      ref: source.ref,
      resolvedValue,
      sourceId: source.sourceId,
      workbookSnapshotId: lineage.id,
    };
  }

  private addRule(
    rules: QuestionFieldRule[],
    block: QuestionBlueprintInputBlock,
    referenceValues: ReadonlyMap<string, JsonValue>,
  ) {
    if (block.grading.mode === "manual") {
      rules.push({
        points: block.points,
        responseFieldId: block.responseFieldId,
        type: "manual",
      });
      return;
    }
    if (!block.correctValueSource) {
      throw new InvalidQuestionBlueprintError(
        "non-manual response grading requires correctValueSource",
      );
    }
    const correctValue = resolveQuestionValue(
      block.correctValueSource,
      referenceValues,
    );
    rules.push(toRule(block.responseFieldId, correctValue, block));
  }
}

function toRule(
  responseFieldId: string,
  correctValue: JsonValue,
  block: QuestionBlueprintInputBlock,
): QuestionFieldRule {
  if (block.grading.mode === "number") {
    const numericCorrectValue = Number(correctValue);
    if (!Number.isFinite(numericCorrectValue)) {
      throw new InvalidQuestionBlueprintError(
        "number grading requires a numeric correct value",
      );
    }
    return {
      correctValue: numericCorrectValue,
      points: block.points,
      responseFieldId,
      tolerance: block.grading.tolerance,
      type: "number",
    };
  }
  if (block.grading.mode === "case_insensitive_text") {
    return {
      correctValue: String(correctValue),
      points: block.points,
      responseFieldId,
      type: "case_insensitive_text",
    };
  }
  return {
    correctValue,
    points: block.points,
    responseFieldId,
    type: "exact",
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
      displayValue: displayValue(
        inlineReferenceValue(part, referenceValues) ?? part.fallbackText ?? "",
      ),
      referenceId: part.referenceId,
      type: "value",
    };
  });
}

function renderRichContent(
  content: RichContent,
  referenceValues: ReadonlyMap<string, JsonValue>,
): RichContent {
  return {
    content: content.content.map((node) =>
      renderRichContentNode(node, referenceValues),
    ),
    type: "doc",
  };
}

function renderRichContentNode(
  node: RichContentNode,
  referenceValues: ReadonlyMap<string, JsonValue>,
): RichContentNode {
  if (node.type === "paragraph") {
    return {
      ...node,
      ...(node.content === undefined
        ? {}
        : { content: renderRichTextNodes(node.content, referenceValues) }),
    };
  }
  if (node.type === "heading") {
    return {
      ...node,
      ...(node.content === undefined
        ? {}
        : { content: renderRichTextNodes(node.content, referenceValues) }),
    };
  }
  return {
    content: node.content.map((item) =>
      renderRichListItem(item, referenceValues),
    ),
    type: node.type,
  };
}

function renderRichListItem(
  item: RichListItemNode,
  referenceValues: ReadonlyMap<string, JsonValue>,
): RichListItemNode {
  return {
    content: item.content.map((child) => {
      if (child.type === "paragraph") {
        return {
          ...child,
          ...(child.content === undefined
            ? {}
            : { content: renderRichTextNodes(child.content, referenceValues) }),
        };
      }
      return {
        content: child.content.map((nestedItem) =>
          renderRichListItem(nestedItem, referenceValues),
        ),
        type: child.type,
      };
    }),
    type: "list_item",
  };
}

function renderRichTextNodes(
  nodes: RichTextNode[],
  referenceValues: ReadonlyMap<string, JsonValue>,
) {
  return nodes.map((node) => ({
    text: renderCanonicalInlineText(node.text, referenceValues),
    type: node.type,
  }));
}

const CANONICAL_REFERENCE_PATTERN =
  /\{\{\s*\.\s*(?:([A-Za-z][A-Za-z0-9_-]*)|\[\s*"((?:[^"\\]|\\.)*)"\s*\])(?:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\])?\s*\}\}/gu;

function renderCanonicalInlineText(
  text: string,
  referenceValues: ReadonlyMap<string, JsonValue>,
) {
  return text.replace(
    CANONICAL_REFERENCE_PATTERN,
    (_raw, simpleReferenceId, bracketReferenceId, rowOffset, columnOffset) => {
      const referenceId = simpleReferenceId
        ? String(simpleReferenceId)
        : decodeBracketReferenceId(String(bracketReferenceId ?? ""));
      const rangeCell =
        rowOffset === undefined || columnOffset === undefined
          ? undefined
          : {
              columnOffset: Number(columnOffset),
              rowOffset: Number(rowOffset),
            };
      const value = inlineReferenceValue(
        {
          referenceId,
          type: "reference",
          ...(rangeCell === undefined ? {} : { rangeCell }),
        },
        referenceValues,
      );
      return value === undefined ? "" : displayValue(value);
    },
  );
}

function decodeBracketReferenceId(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
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
