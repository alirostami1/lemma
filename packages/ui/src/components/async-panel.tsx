import type { ReactNode } from "react";

export type AsyncPanelProps = {
  isLoading: boolean;
  errorMessage: string | null;
  isEmpty: boolean;
  loading: ReactNode;
  empty: ReactNode;
  children: ReactNode;
  error?: ReactNode | ((message: string) => ReactNode);
};

function AsyncPanel({
  isLoading,
  errorMessage,
  isEmpty,
  loading,
  empty,
  children,
  error,
}: AsyncPanelProps) {
  if (isLoading) {
    return loading;
  }

  if (errorMessage && isEmpty) {
    if (typeof error === "function") {
      return error(errorMessage);
    }
    return error ?? null;
  }

  if (isEmpty) {
    return empty;
  }

  return children;
}

export { AsyncPanel };
