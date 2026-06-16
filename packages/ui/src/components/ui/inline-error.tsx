import { Button } from "#/components/ui/button";

export type InlineErrorProps = {
  message: string;
  onRetry?: () => void;
};

function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export { InlineError };
