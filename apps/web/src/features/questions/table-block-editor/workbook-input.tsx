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
  workbookSelectionRequirement = {},
  onWorkbookSelect,
  ...props
}: WorkbookInputProps) {
  const { className: containerClassName, ...restContainerProps } =
    containerProps ?? {};
  const workbookPicker = useWorkbookPicker();

  function openWorkbook() {
    workbookPicker.openWorkbookPicker({
      selectionRequirement: workbookSelectionRequirement,
      onSelect: onWorkbookSelect,
    });
  }

  return (
    <div
      data-slot="workbook-input"
      className={cn("relative", containerClassName)}
      {...restContainerProps}
    >
      <Input className={cn("pr-9", className)} disabled={disabled} {...props} />
      <Button
        aria-label="Open workbook range picker"
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openWorkbook();
        }}
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
  workbookSelectionRequirement = {},
  onWorkbookSelect,
  ...props
}: WorkbookInputGroupProps) {
  const { className: inputGroupClassName, ...restInputGroupProps } =
    inputGroupProps ?? {};
  const workbookPicker = useWorkbookPicker();
  function openWorkbook() {
    workbookPicker.openWorkbookPicker({
      selectionRequirement: workbookSelectionRequirement,
      onSelect: onWorkbookSelect,
    });
  }

  return (
    <InputGroup
      data-slot="workbook-input-group"
      className={inputGroupClassName}
      {...restInputGroupProps}
    >
      <InputGroupInput className={className} disabled={disabled} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label="Open workbook range picker"
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled}
          className="cursor-pointer"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openWorkbook();
          }}
        >
          <Crosshair />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
