import { describe, expect, it } from "vitest";
import {
  createSaveBlueprintDialogViewModel,
  type SaveDialogState,
} from "./save-blueprint-dialog";

describe("save blueprint dialog state", () => {
  it("shows a create-only dialog for a new unsaved blueprint", () => {
    const viewModel = createSaveBlueprintDialogViewModel(
      createState({
        hasExistingBlueprint: false,
        isDirty: true,
      }),
      false,
    );

    expect(viewModel).toMatchObject({
      defaultMode: "save_as_new",
      description: "This will create a reusable blueprint.",
      shouldShowModeChoice: false,
    });
    expect(viewModel.helperText).toBe(
      "This name will appear in the saved blueprint list.",
    );
    expect(viewModel.isSaveDisabled).toBe(false);
  });

  it("shows update and copy choices for a dirty existing blueprint", () => {
    const viewModel = createSaveBlueprintDialogViewModel(
      createState({
        hasExistingBlueprint: true,
        isDirty: true,
      }),
      false,
    );

    expect(viewModel).toMatchObject({
      defaultMode: "update_existing",
      description: "Choose how to save your changes.",
      shouldShowModeChoice: true,
    });
    expect(viewModel.isSaveDisabled).toBe(false);
  });

  it("uses copy mode for an unchanged existing blueprint", () => {
    const viewModel = createSaveBlueprintDialogViewModel(
      createState({
        hasExistingBlueprint: true,
        isDirty: false,
      }),
      false,
    );

    expect(viewModel).toMatchObject({
      defaultMode: "save_as_new",
      description: "Enter a new name to save a copy.",
      shouldShowModeChoice: false,
    });
    expect(viewModel.helperText).toBe("Use a new name to create a copy.");
    expect(viewModel.isSaveDisabled).toBe(false);
    expect(viewModel.disabledIssue).toBeNull();
  });

  it("shows validation issues as disabled issues", () => {
    const viewModel = createSaveBlueprintDialogViewModel(
      createState({
        validationIssue: "Select a workbook to reference cells.",
      }),
      false,
    );

    expect(viewModel.disabledIssue).toBe(
      "Select a workbook to reference cells.",
    );
    expect(viewModel.isSaveDisabled).toBe(true);
  });

  it("disables save while saving", () => {
    const viewModel = createSaveBlueprintDialogViewModel(createState(), true);

    expect(viewModel.isSaveDisabled).toBe(true);
  });

  it("hides mode choice when unchanged existing blueprints save as copies", () => {
    const viewModel = createSaveBlueprintDialogViewModel(
      createState({
        hasExistingBlueprint: true,
        isDirty: false,
      }),
      false,
    );

    expect(viewModel.defaultMode).toBe("save_as_new");
    expect(viewModel.isSaveDisabled).toBe(false);
    expect(viewModel.shouldShowModeChoice).toBe(false);
  });
});

function createState(
  overrides: Partial<SaveDialogState> = {},
): SaveDialogState {
  return {
    currentName: "Question blueprint",
    hasExistingBlueprint: false,
    isDirty: true,
    validationIssue: null,
    ...overrides,
  };
}
