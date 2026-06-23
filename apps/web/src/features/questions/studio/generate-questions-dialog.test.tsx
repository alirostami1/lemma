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
          onSubmit,
          questionSets: [questionSet("Recent set")],
          selectedQuestionSetId: "set-recent-set",
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
          countIssue: "Generation count must be between 1 and 100.",
          isGenerateDisabled: true,
          questionSetsLoading: true,
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
    countInput: "1",
    countIssue: null,
    existingQuestionSetIssue: null,
    isGenerateDisabled: false,
    isSubmitting: false,
    newQuestionSetDescription: "",
    newQuestionSetName: "",
    newQuestionSetNameIssue: null,
    onCountInputChange: () => {},
    onNewQuestionSetDescriptionChange: () => {},
    onNewQuestionSetNameChange: () => {},
    onOpenChange: () => {},
    onQuestionSetValueChange: () => {},
    onSubmit: () => {},
    open: true,
    questionSetMode: "create_new",
    questionSets: [],
    questionSetsErrorMessage: null,
    questionSetsLoading: false,
    selectedQuestionSetId: "",
    source: {
      blueprintId: "blueprint-1",
      kind: "saved_blueprint",
      name: "Blueprint",
      sources: [],
    },
    submitError: null,
    ...overrides,
  };
}

function questionSet(
  name: string,
  status: QuestionSet["status"] = "active",
): QuestionSet {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    createdAt: timestamp,
    createdByUserId: "creator",
    description: null,
    id: `set-${name.toLowerCase().replace(/\s+/gu, "-")}`,
    name,
    ownerUserId: "owner",
    status,
    updatedAt: timestamp,
  };
}
