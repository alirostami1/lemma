import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@lemma/ui/components/field";
import { Switch } from "@lemma/ui/components/switch";
import { Children, isValidElement, type ReactNode } from "react";

function getFirstChildControlId(children: ReactNode): string | undefined {
  let controlId: string | undefined;
  Children.forEach(children, (child) => {
    if (controlId !== undefined) {
      return;
    }
    if (!isValidElement(child)) {
      return;
    }
    const elementProps = child.props as {
      id?: string;
      children?: ReactNode;
      onChange?: unknown;
    };
    if (
      typeof elementProps.id === "string" &&
      typeof elementProps.onChange === "function"
    ) {
      controlId = elementProps.id;
      return;
    }
    const nestedId = getFirstChildControlId(elementProps.children);
    if (nestedId !== undefined) {
      controlId = nestedId;
    }
  });
  return controlId;
}

export function InspectorField({
  label,
  description,
  error,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  const controlId = getFirstChildControlId(children);

  return (
    <Field className="grid gap-2">
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <div className="grid gap-2">
        {children}
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </Field>
  );
}

export function InspectorSwitchField({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange(checked: boolean): void;
}) {
  return (
    <Field className="grid gap-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
        <div className="grid gap-0.5">
          <FieldLabel className="p-0">{label}</FieldLabel>
          {description ? (
            <FieldDescription className="text-xs">
              {description}
            </FieldDescription>
          ) : null}
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </Field>
  );
}
