export function EditorToolbar({ blockCount }: { blockCount: number }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold">Canvas</p>
      <p className="text-xs text-muted-foreground">
        {blockCount} {blockCount === 1 ? "block" : "blocks"}
      </p>
    </div>
  );
}
