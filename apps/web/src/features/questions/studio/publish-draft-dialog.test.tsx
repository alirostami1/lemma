// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createPublishDraftDialogViewModel,
  PublishDraftDialog,
} from "./publish-draft-dialog";

describe("PublishDraftDialog", () => {
  it("uses publish semantics without old save modes", () => {
    render(
      <PublishDraftDialog
        isPublishing={false}
        isSavingBeforePublish={false}
        onOpenChange={() => {}}
        onPublish={() => {}}
        open
        state={{
          currentName: "Cell structure quiz",
          validationIssue: null,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Publish" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This saves your changes and publishes the blueprint."),
    ).toBeInTheDocument();
    expect(
      screen.getByText('"Cell structure quiz" will be saved and published.'),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.queryByText(/publish draft/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/immutable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/version/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/save as new/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/update existing/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });

  it("publishes without unused dialog input", () => {
    const onPublish = vi.fn();
    render(
      <PublishDraftDialog
        isPublishing={false}
        isSavingBeforePublish={false}
        onOpenChange={() => {}}
        onPublish={onPublish}
        open
        state={{
          currentName: "Cell structure quiz",
          validationIssue: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(onPublish).toHaveBeenCalledWith();
  });
});

describe("createPublishDraftDialogViewModel", () => {
  it("blocks publish when the blueprint has a validation issue", () => {
    const viewModel = createPublishDraftDialogViewModel(
      {
        currentName: "Draft",
        validationIssue: "Add a question.",
      },
      false,
    );

    expect(viewModel.disabledIssue).toBe("Add a question.");
    expect(viewModel.isPublishDisabled).toBe(true);
  });

  it("blocks duplicate publish submissions while publishing", () => {
    const viewModel = createPublishDraftDialogViewModel(
      {
        currentName: "Draft",
        validationIssue: null,
      },
      true,
    );

    expect(viewModel.isPublishDisabled).toBe(true);
  });

  it("uses saving label before publish mutation starts", () => {
    render(
      <PublishDraftDialog
        isPublishing={false}
        isSavingBeforePublish
        onOpenChange={() => {}}
        onPublish={() => {}}
        open
        state={{
          currentName: "Cell structure quiz",
          validationIssue: null,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.queryByText("Publishing...")).not.toBeInTheDocument();
  });
});
