import { ScrollArea } from "@lemma/ui/components/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@lemma/ui/components/tabs";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { getComposedEditorSelectedBlock } from "../composed-editor-operations";
import type { EditorSelection } from "../editor-selection";
import { ElementsTab } from "./elements-tab";
import { ReferencesTab } from "./references-tab";

type InspectorTab = "references" | "elements";

export function InspectorPanel({
  model,
  selection,
  referencePreviewCache,
  workbookEnabled,
  disabled,
  activeSourceId,
  onModelChange,
  onSelectionChange,
  stickyOffset = 80,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  activeSourceId?: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
  stickyOffset?: number;
}) {
  const selectedBlock = getComposedEditorSelectedBlock(model, selection);
  const selectedReferenceId =
    selection.type === "reference" ? selection.referenceId : null;
  const [activeTab, setActiveTab] = useState<InspectorTab>(
    selection.type === "reference" ? "references" : "elements",
  );

  useEffect(() => {
    setActiveTab(selection.type === "reference" ? "references" : "elements");
  }, [selection.type, selectedReferenceId]);

  const measuredStickyOffset = Math.max(stickyOffset, 0);
  const stickyStyle = {
    "--inspector-sticky-offset": `${measuredStickyOffset}px`,
    top: measuredStickyOffset,
    height: `calc(100dvh - ${measuredStickyOffset}px)`,
  } as CSSProperties;

  return (
    <aside
      aria-label="Element and reference settings"
      style={stickyStyle}
      className="sticky self-start overflow-hidden rounded-lg border bg-background shadow-sm"
    >
      <div className="flex h-full min-h-0 flex-col p-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as InspectorTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="elements">Element</TabsTrigger>
            <TabsTrigger value="references">References</TabsTrigger>
          </TabsList>

          <TabsContent value="references" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-full min-h-0 pr-3">
              <div className="grid gap-3 pb-8">
                <ReferencesTab
                  model={model}
                  selection={selection}
                  referencePreviewCache={referencePreviewCache}
                  workbookEnabled={workbookEnabled}
                  activeSourceId={activeSourceId}
                  disabled={disabled}
                  onModelChange={onModelChange}
                  onSelectionChange={onSelectionChange}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="elements" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-full min-h-0 pr-3">
              <div className="grid gap-3 pb-8">
                <ElementsTab
                  model={model}
                  selection={selection}
                  selectedBlock={selectedBlock}
                  referencePreviewCache={referencePreviewCache}
                  workbookEnabled={workbookEnabled}
                  disabled={disabled}
                  onModelChange={onModelChange}
                  onSelectionChange={onSelectionChange}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
