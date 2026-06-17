// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateQuestionSetDialogController as CreateQuestionSetDialog } from "./create-question-set-dialog";

const mutateAsync = vi.fn();

vi.mock("#/domains/questions", () => ({
  useCreateQuestionSet: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

describe("CreateQuestionSetDialog", () => {
  afterEach(() => {
    cleanup();
    mutateAsync.mockReset();
  });

  it("creates a question set from the dialog", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    mutateAsync.mockResolvedValueOnce({
      questionSet: {
        id: "set_1",
        ownerUserId: "user_1",
        createdByUserId: "user_1",
        name: "Math practice",
        description: null,
        status: "active",
        createdAt: new Date("2026-06-08T00:00:00.000Z"),
        updatedAt: new Date("2026-06-08T00:00:00.000Z"),
      },
    });

    render(<CreateQuestionSetDialog onCreated={onCreated} />);

    await user.click(
      screen.getByRole("button", { name: "Create question set" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Math practice");
    await user.click(
      within(dialog).getByRole("button", { name: "Create question set" }),
    );

    expect(mutateAsync).toHaveBeenCalledWith({ name: "Math practice" });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "set_1", name: "Math practice" }),
    );
  });
});
