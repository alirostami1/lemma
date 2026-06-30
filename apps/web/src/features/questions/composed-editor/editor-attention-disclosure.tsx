import { Button } from "@lemma/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@lemma/ui/components/collapsible";
import { AlertTriangle } from "lucide-react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { EditorSelection } from "./editor-selection";
import type { DocumentReadinessIssue } from "./inspector/document-readiness-issue";
import {
  type ReferenceRecoveryItem,
  ReferenceRecoveryPanel,
} from "./inspector/reference-recovery-panel";

export function EditorAttentionDisclosure({
  disabled,
  documentIssues = [],
  model,
  onModelChange,
  onSelectionChange,
  referenceRecoveryItems = [],
}: {
  disabled?: boolean;
  documentIssues?: readonly DocumentReadinessIssue[];
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
  referenceRecoveryItems?: readonly ReferenceRecoveryItem[];
}) {
  const attentionCount = documentIssues.length + referenceRecoveryItems.length;
  if (attentionCount === 0) {
    return null;
  }

  return (
    <Collapsible>
      <section className="rounded-lg border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="grid gap-0.5">
              <h2 className="text-sm font-medium">Needs review</h2>
              <p className="text-xs text-muted-foreground">
                {attentionCount} item{attentionCount === 1 ? "" : "s"} before
                publishing.
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" type="button" variant="outline">
              Review
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="grid gap-3 border-t p-3">
            <ReferenceRecoveryPanel
              disabled={disabled}
              items={referenceRecoveryItems}
              model={model}
              onModelChange={onModelChange}
              onSelectionChange={onSelectionChange}
            />
            {documentIssues.length ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-medium">Blueprint checks</p>
                <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  {documentIssues.map((issue) => (
                    <li key={issue.id}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
