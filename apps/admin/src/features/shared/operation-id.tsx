import { shortId } from "./format";

export function OperationId({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="font-mono text-xs text-muted-foreground" title={value}>
      {shortId(value)}
    </span>
  );
}
