// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  StudioDraftRecoveryDialog,
  StudioResetConfirmationDialog,
} from "./studio-draft-recovery-dialog";

describe("StudioDraftRecoveryDialog", () => {
  it("uses saved changes copy", () => {
    render(
      <StudioDraftRecoveryDialog
        onDiscard={vi.fn()}
        onKeepCurrent={vi.fn()}
        onRestore={vi.fn()}
        open={true}
        snapshot={{
          authoringModel: {
            blocks: [],
            references: [],
            responseFields: [],
            schemaVersion: 1,
          },
          blueprintDescription: "",
          blueprintName: "Blueprint",
          draftKey: "draft-key",
          lastLocalSaveTimestamp: new Date(
            "2026-06-24T00:00:00.000Z",
          ).valueOf(),
          lastRemoteSaveSnapshotKey: null,
          loadedBlueprintId: "blueprint-1",
          schemaVersion: 2,
          sources: [],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Saved changes found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Discard changes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore changes" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/local draft/i)).not.toBeInTheDocument();
  });
});

describe("StudioResetConfirmationDialog", () => {
  it("describes resetting current work", () => {
    render(
      <StudioResetConfirmationDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
      />,
    );

    expect(
      screen.getByText(
        "This clears the current work and starts a fresh blueprint. Saved blueprints are not deleted.",
      ),
    ).toBeInTheDocument();
  });
});
