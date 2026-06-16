// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuestionSet } from "#/domains/questions/model";
import { GenerateQuestionsDialog } from "./generation/generate-questions-dialog";
import type { GenerateQuestionsDialogProps } from "./generation/generation-controller-types";
import { getQuestionSetsForGeneration } from "./generation/use-generate-questions-dialog-controller";

describe("generate questions dialog", () => {
  afterEach(cleanup);

  it("emits submit without owning generation workflow", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <GenerateQuestionsDialog
        {...props({
          questionSets: [questionSet("Recent set")],
          selectedQuestionSetId: "set-recent-set",
          onSubmit,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("renders controller-provided loading and validation state", () => {
    render(
      <GenerateQuestionsDialog
        {...props({
          questionSetsLoading: true,
          countIssue: "Generation count must be between 1 and 100.",
          isGenerateDisabled: true,
        })}
      />,
    );

    expect(screen.getByText("Loading question sets...")).toBeTruthy();
    expect(
      screen.getByText("Generation count must be between 1 and 100."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("filters deleted question sets for generation", () => {
    expect(
      getQuestionSetsForGeneration([
        questionSet("Deleted set", "deleted"),
        questionSet("Active set"),
      ]).map((item) => item.name),
    ).toEqual(["Active set"]);
  });
});

function props(
  overrides: Partial<GenerateQuestionsDialogProps> = {},
): GenerateQuestionsDialogProps {
  return {
    open: true,
    source: {
      kind: "saved_blueprint",
      blueprintId: "blueprint-1",
      blueprintVersionId: "version-1",
      name: "Blueprint",
      workbookId: null,
    },
    questionSets: [],
    questionSetsLoading: false,
    questionSetsErrorMessage: null,
    questionSetMode: "create_new",
    selectedQuestionSetId: "",
    newQuestionSetName: "",
    newQuestionSetDescription: "",
    countInput: "1",
    isSubmitting: false,
    isGenerateDisabled: false,
    countIssue: null,
    existingQuestionSetIssue: null,
    newQuestionSetNameIssue: null,
    submitError: null,
    onOpenChange: () => {},
    onSubmit: () => {},
    onQuestionSetValueChange: () => {},
    onNewQuestionSetNameChange: () => {},
    onNewQuestionSetDescriptionChange: () => {},
    onCountInputChange: () => {},
    ...overrides,
  };
}

function questionSet(
  name: string,
  status: QuestionSet["status"] = "active",
): QuestionSet {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    id: `set-${name.toLowerCase().replace(/\s+/gu, "-")}`,
    ownerUserId: "owner",
    createdByUserId: "creator",
    name,
    description: null,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
