import {
  createQuestion,
  createQuestionSetQuestion,
  type Question,
  type QuestionBlueprintSnapshot,
  type QuestionBlueprintSource,
  type QuestionGenerationRun,
  type QuestionProducer,
  type QuestionSetQuestion,
  questionBlueprintSourcesReferencedByDocument,
  questionProducer,
  questionId as toQuestionId,
} from "../domain/index.js";
import { CanonicalQuestionMaterializer } from "./CanonicalQuestionMaterializer.js";
import { WorkbookQuestionReferenceError } from "./errors.js";
import {
  type Clock,
  type IdGenerator,
  type QuestionGenerationSnapshotKey,
  type QuestionValueResolverPort,
  questionGenerationSnapshotKey,
  type WorkbookSnapshotForQuestionGeneration,
} from "./ports.js";
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
    blueprintSnapshot: QuestionBlueprintSnapshot;
    usedSources: readonly QuestionBlueprintSource[];
    snapshotsBySourceIdAndQuestionIndex: ReadonlyMap<
      QuestionGenerationSnapshotKey,
      WorkbookSnapshotForQuestionGeneration
    >;
  }): Promise<MaterializedQuestionGenerationRun> {
    const {
      run,
      blueprintSnapshot,
      usedSources,
      snapshotsBySourceIdAndQuestionIndex,
    } = input;
    const requiresWorkbook = blueprintRequiresWorkbookSource(
      blueprintSnapshot.document,
    );
    const referencedSources = questionBlueprintSourcesReferencedByDocument(
      blueprintSnapshot.document,
      blueprintSnapshot.sources,
    );
    if (requiresWorkbook && snapshotsBySourceIdAndQuestionIndex.size === 0) {
      throw new WorkbookQuestionReferenceError(
        "generation run has no workbook snapshot",
      );
    }

    const materializer = new CanonicalQuestionMaterializer(
      this.deps.questionValueResolverPort,
    );
    const questions: Question[] = [];
    for (let index = 0; index < run.requestedCount; index += 1) {
      const sourceLineageBySourceId = buildSourceLineageBySourceId({
        questionIndex: index,
        snapshotsBySourceIdAndQuestionIndex,
        sources: usedSources,
      });
      const materialized = await materializer.materialize({
        document: blueprintSnapshot.document,
        generationRunId: run.id,
        questionIndex: index,
        sourceLineageBySourceId,
        sources: referencedSources,
        workbookCalculationId: run.workbookCalculationId,
      });
      questions.push(
        createQuestion(
          {
            blueprintId: run.blueprintId,
            body: materialized.body,
            createdByUserId: run.createdByUserId,
            generationRunId: run.id,
            id: toQuestionId(this.deps.idGenerator.questionId()),
            ownerUserId: run.ownerUserId,
            producer: createGenerationProducer({ questionIndex: index, run }),
            solution: materialized.solution,
            sourceEvidence: materialized.sourceEvidence,
            sourcePlan: materialized.sourcePlan,
          },
          this.deps.clock.now(),
        ),
      );
    }

    return {
      memberships: questions.map((question) =>
        createQuestionSetQuestion(
          {
            addedByUserId: run.createdByUserId,
            questionId: question.id,
            questionSetId: run.targetQuestionSetId,
          },
          this.deps.clock.now(),
        ),
      ),
      questions,
    };
  }
}

function buildSourceLineageBySourceId(input: {
  sources: readonly QuestionBlueprintSource[];
  snapshotsBySourceIdAndQuestionIndex: ReadonlyMap<
    QuestionGenerationSnapshotKey,
    WorkbookSnapshotForQuestionGeneration
  >;
  questionIndex: number;
}): ReadonlyMap<string, WorkbookSnapshotForQuestionGeneration> | undefined {
  if (input.sources.length === 0) {
    return undefined;
  }

  const lineageBySourceId = new Map<
    string,
    WorkbookSnapshotForQuestionGeneration
  >();
  for (const source of input.sources) {
    const snapshot = input.snapshotsBySourceIdAndQuestionIndex.get(
      questionGenerationSnapshotKey({
        questionIndex: input.questionIndex,
        sourceId: source.sourceId,
      }),
    );
    if (snapshot) {
      lineageBySourceId.set(source.sourceId, snapshot);
    }
  }
  return lineageBySourceId;
}

function createGenerationProducer(input: {
  run: QuestionGenerationRun;
  questionIndex: number;
}): QuestionProducer {
  return questionProducer({
    compiler: "canonical-question-materializer@1",
    schemaVersion: 1,
    source: {
      blueprintDocumentHash: input.run.blueprintSnapshot.documentHash,
      blueprintId: input.run.blueprintId,
      generationRunId: input.run.id,
      questionIndex: input.questionIndex,
    },
  });
}
