import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import type {
  QuestionReferenceSource,
  WorkbookSnapshotId,
} from "../domain/index.js";
import { WorkbookQuestionSourceError } from "./errors.js";
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
          throw new WorkbookQuestionSourceError(
            "workbook references require a workbook snapshot",
          );
        }
        const source = toWorkbookValueSource(input.source);
        if (input.currentUser) {
          return this.deps.workbookSnapshotResolverPort.resolveValueSource({
            currentUser: input.currentUser,
            workbookSnapshotId: input.workbookSnapshotId,
            source,
          });
        }
        return this.deps.workbookInternalSnapshotResolverPort.resolveValueSource(
          {
            workbookSnapshotId: input.workbookSnapshotId,
            source,
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
    return { type: "cell", sourceId: source.sourceId, ref: source.ref };
  }
  if (source.type === "workbook_range") {
    return { type: "range", sourceId: source.sourceId, ref: source.ref };
  }
  if (source.type === "literal") {
    return { type: "literal", value: source.value };
  }
  throw new WorkbookQuestionSourceError(
    "question reference source is not supported",
  );
}
