import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@lemma/ui/components/input-group";
import { cn } from "@lemma/ui/lib/utils";
import { Crosshair } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from "react";

export type WorkbookSelectionType = "any" | "cell" | "range";

export type WorkbookDimensionBounds = {
  min?: number;
  max?: number;
};

export type WorkbookSelectionRequirement = {
  selectionType?: WorkbookSelectionType;
  rows?: WorkbookDimensionBounds;
  columns?: WorkbookDimensionBounds;
};

export type WorkbookRangeSelection = {
  sourceId: string;
  reference: string;
  values: string[][];
};

export type WorkbookPickerRequest = {
  sourceId: string | null;
  selectionRequirement?: WorkbookSelectionRequirement;
  onSelect(selection: WorkbookRangeSelection): void;
};

export type WorkbookPickerController = {
  openWorkbookPicker(request: WorkbookPickerRequest): void;
};

const WorkbookPickerContext = createContext<WorkbookPickerController | null>(
  null,
);

export function WorkbookPickerProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WorkbookPickerController;
}) {
  return (
    <WorkbookPickerContext.Provider value={value}>
      {children}
    </WorkbookPickerContext.Provider>
  );
}

export function useWorkbookPicker() {
  const controller = useContext(WorkbookPickerContext);
  if (!controller) {
    throw new Error(
      "useWorkbookPicker must be used within a WorkbookPickerProvider.",
    );
  }
  return controller;
}

type WorkbookPickerProps = {
  sourceId?: string | null;
  workbookSelectionRequirement?: WorkbookSelectionRequirement;
  onWorkbookSelect(selection: WorkbookRangeSelection): void;
};

export type WorkbookInputProps = ComponentProps<typeof Input> &
  WorkbookPickerProps & {
    containerProps?: ComponentProps<"div">;
  };

export function WorkbookInput({
  className,
  containerProps,
  disabled,
  sourceId = null,
  workbookSelectionRequirement = {},
  onWorkbookSelect,
  ...props
}: WorkbookInputProps) {
  const { className: containerClassName, ...restContainerProps } =
    containerProps ?? {};
  const workbookPicker = useWorkbookPicker();

  function openWorkbook() {
    workbookPicker.openWorkbookPicker({
      onSelect: onWorkbookSelect,
      selectionRequirement: workbookSelectionRequirement,
      sourceId,
    });
  }

  return (
    <div
      className={cn("relative", containerClassName)}
      data-slot="workbook-input"
      {...restContainerProps}
    >
      <Input className={cn("pr-9", className)} disabled={disabled} {...props} />
      <Button
        aria-label="Open workbook range picker"
        className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openWorkbook();
        }}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Crosshair />
      </Button>
    </div>
  );
}

export type WorkbookInputGroupProps = ComponentProps<typeof InputGroupInput> &
  WorkbookPickerProps & {
    inputGroupProps?: ComponentProps<typeof InputGroup>;
  };

export function WorkbookInputGroup({
  className,
  disabled,
  inputGroupProps,
  sourceId = null,
  workbookSelectionRequirement = {},
  onWorkbookSelect,
  ...props
}: WorkbookInputGroupProps) {
  const { className: inputGroupClassName, ...restInputGroupProps } =
    inputGroupProps ?? {};
  const workbookPicker = useWorkbookPicker();
  function openWorkbook() {
    workbookPicker.openWorkbookPicker({
      onSelect: onWorkbookSelect,
      selectionRequirement: workbookSelectionRequirement,
      sourceId,
    });
  }

  return (
    <InputGroup
      className={inputGroupClassName}
      data-slot="workbook-input-group"
      {...restInputGroupProps}
    >
      <InputGroupInput className={className} disabled={disabled} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label="Open workbook range picker"
          className="cursor-pointer"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openWorkbook();
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Crosshair />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
