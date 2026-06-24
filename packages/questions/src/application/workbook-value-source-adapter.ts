import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import type {
  QuestionReferenceSource,
  WorkbookSnapshotId,
} from "../domain/index.js";
import { WorkbookQuestionReferenceError } from "./errors.js";
import type {
  QuestionValueResolverPort,
  WorkbookInternalSnapshotResolverPort,
  WorkbookSnapshotResolverPort,
  WorkbookValueSource,
} from "./ports.js";

const instrumentation = instrumentService(
  "questions",
  "workbook_value_resolver",
);

export class WorkbookQuestionValueResolverAdapter
  implements QuestionValueResolverPort
{
  constructor(
    private readonly deps: {
      workbookSnapshotResolverPort: WorkbookSnapshotResolverPort;
      workbookInternalSnapshotResolverPort: WorkbookInternalSnapshotResolverPort;
    },
  ) {}

  resolveReference(input: {
    currentUser?: CurrentUser;
    workbookSnapshotId?: WorkbookSnapshotId | null;
    source: QuestionReferenceSource;
  }) {
    return instrumentation.run(
      "resolve_reference",
      {
        attributes: { "questions.reference_source.type": input.source.type },
      },
      async () => {
        if (input.source.type === "literal") {
          return input.source.value;
        }
        if (!input.workbookSnapshotId) {
          throw new WorkbookQuestionReferenceError(
            "workbook references require a workbook snapshot",
          );
        }
        const source = toWorkbookValueSource(input.source);
        if (input.currentUser) {
          return this.deps.workbookSnapshotResolverPort.resolveValueSource({
            currentUser: input.currentUser,
            source,
            workbookSnapshotId: input.workbookSnapshotId,
          });
        }
        return this.deps.workbookInternalSnapshotResolverPort.resolveValueSource(
          {
            source,
            workbookSnapshotId: input.workbookSnapshotId,
          },
        );
      },
    );
  }
}

export function toWorkbookValueSource(
  source: QuestionReferenceSource,
): WorkbookValueSource {
  if (source.type === "workbook_cell") {
    return { ref: source.ref, sourceId: source.sourceId, type: "cell" };
  }
  if (source.type === "workbook_range") {
    return { ref: source.ref, sourceId: source.sourceId, type: "range" };
  }
  if (source.type === "literal") {
    return { type: "literal", value: source.value };
  }
  throw new WorkbookQuestionReferenceError(
    "question reference source is not supported",
  );
}
