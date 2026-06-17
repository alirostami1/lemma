import {
  createQuestion,
  createQuestionSetQuestion,
  type Question,
  type QuestionBlueprintVersion,
  type QuestionGenerationRun,
  type QuestionProducer,
  type QuestionSetQuestion,
  questionProducer,
  questionId as toQuestionId,
  type WorkbookSnapshotId,
} from "../domain/index.js";
import { CanonicalQuestionMaterializer } from "./CanonicalQuestionMaterializer.js";
import { WorkbookQuestionSourceError } from "./errors.js";
import type { Clock, IdGenerator, QuestionValueResolverPort } from "./ports.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";

export type MaterializedQuestionGenerationRun = {
  questions: Question[];
  memberships: QuestionSetQuestion[];
};

export class QuestionGenerationRunMaterializer {
  constructor(
    private readonly deps: {
      clock: Clock;
      idGenerator: IdGenerator;
      questionValueResolverPort: QuestionValueResolverPort;
    },
  ) {}

  async materialize(input: {
    run: QuestionGenerationRun;
    version: QuestionBlueprintVersion;
    workbookSnapshotIds: readonly WorkbookSnapshotId[];
  }): Promise<MaterializedQuestionGenerationRun> {
    const { run, version, workbookSnapshotIds } = input;
    const requiresWorkbook = blueprintRequiresWorkbookSource(version.document);
    if (requiresWorkbook && workbookSnapshotIds.length === 0) {
      throw new WorkbookQuestionSourceError(
        "generation run has no workbook snapshot",
      );
    }
    if (
      requiresWorkbook &&
      !run.source?.workbookSnapshotId &&
      workbookSnapshotIds.length < run.requestedCount
    ) {
      throw new WorkbookQuestionSourceError(
        "workbook calculation produced fewer snapshots than requested",
      );
    }

    const materializer = new CanonicalQuestionMaterializer(
      this.deps.questionValueResolverPort,
    );
    const questions: Question[] = [];
    for (let index = 0; index < run.requestedCount; index += 1) {
      const workbookSnapshotId =
        workbookSnapshotIds[index] ?? workbookSnapshotIds[0] ?? null;
      const questionSource =
        run.source && workbookSnapshotId
          ? {
              ...run.source,
              workbookSnapshotId,
            }
          : run.source;
      const materialized = await materializer.materialize({
        document: version.document,
        workbookSnapshotId,
      });
      questions.push(
        createQuestion(
          {
            id: toQuestionId(this.deps.idGenerator.questionId()),
            ownerUserId: run.ownerUserId,
            createdByUserId: run.createdByUserId,
            blueprintId: run.blueprintId,
            blueprintVersionId: version.id,
            generationRunId: run.id,
            body: materialized.body,
            solution: materialized.solution,
            sourcePlan: materialized.sourcePlan,
            producer: createGenerationProducer({ run, version }),
            source: questionSource,
          },
          this.deps.clock.now(),
        ),
      );
    }

    return {
      questions,
      memberships: questions.map((question) =>
        createQuestionSetQuestion(
          {
            questionSetId: run.targetQuestionSetId,
            questionId: question.id,
            addedByUserId: run.createdByUserId,
          },
          this.deps.clock.now(),
        ),
      ),
    };
  }
}

function createGenerationProducer(input: {
  run: QuestionGenerationRun;
  version: QuestionBlueprintVersion;
}): QuestionProducer {
  return questionProducer({
    schemaVersion: 1,
    compiler: "canonical-question-materializer@1",
    source: {
      blueprintId: input.run.blueprintId,
      blueprintVersionId: input.version.id,
      generationRunId: input.run.id,
    },
  });
}
