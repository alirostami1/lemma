import type { ComposedRichContent } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { RichContentPreview } from "#/features/questions/editor-shared";

export function RichTextBlockRenderer({
  content,
  referencePreviewCache,
}: {
  content: ComposedRichContent;
  referencePreviewCache: ReferencePreviewCache;
}) {
  return (
    <div className="grid gap-2 text-sm leading-6">
      <RichContentPreview
        content={content}
        mode="preview"
        referencePreviewCache={referencePreviewCache}
      />
    </div>
  );
}
