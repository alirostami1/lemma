import { Skeleton } from "@lemma/ui/components/skeleton";

export function TableSkeleton({ rows }: { rows: number }) {
  return (
    <output className="grid gap-2">
      <span className="sr-only">Loading table...</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton className="h-10 w-full" key={index} />
      ))}
    </output>
  );
}
