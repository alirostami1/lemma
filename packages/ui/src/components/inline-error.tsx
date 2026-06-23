import { Button } from "#components/button";

export type InlineErrorProps = {
  message: string;
  onRetry?: () => void;
};

function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export { InlineError };
