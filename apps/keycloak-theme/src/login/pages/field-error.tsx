import type { ReactNode } from "react";

export function FieldError(props: { children: ReactNode }) {
  return <p className="text-sm text-destructive">{props.children}</p>;
}
