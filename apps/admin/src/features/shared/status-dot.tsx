export function StatusDot({ tone }: { tone: "bad" | "good" | "neutral" }) {
  return (
    <span
      aria-hidden="true"
      className={
        tone === "bad"
          ? "size-2 rounded-full bg-destructive"
          : tone === "good"
            ? "size-2 rounded-full bg-chart-2"
            : "size-2 rounded-full bg-muted-foreground"
      }
    />
  );
}
