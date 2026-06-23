// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbookUploadForm } from "./workbook-upload-form";

const createFileUpload = vi.fn();
const completeFileUpload = vi.fn();
const createWorkbook = vi.fn();

vi.mock("#/domains/files/hooks", () => ({
  useCompleteFileUpload: () => ({
    isPending: false,
    mutateAsync: completeFileUpload,
  }),
  useCreateFileUpload: () => ({
    isPending: false,
    mutateAsync: createFileUpload,
  }),
}));

vi.mock("#/domains/workbooks/hooks", () => ({
  useCreateWorkbook: () => ({
    isPending: false,
    mutateAsync: createWorkbook,
  }),
}));

describe("WorkbookUploadForm", () => {
  afterEach(() => {
    cleanup();
    createFileUpload.mockReset();
    completeFileUpload.mockReset();
    createWorkbook.mockReset();
    vi.unstubAllGlobals();
  });

  it("validates missing and invalid files", async () => {
    const user = userEvent.setup();
    render(<WorkbookUploadForm onCreated={() => {}} />);

    await user.type(screen.getByLabelText("Source name"), "Q1 Workbook");
    expect(
      screen.getByRole("button", { name: "Create source" }),
    ).toBeDisabled();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const invalidFile = new File(["hello"], "notes.txt", {
      type: "text/plain",
    });
    const fileList = {
      0: invalidFile,
      item: () => invalidFile,
      length: 1,
    };

    fireEvent.change(fileInput, {
      currentTarget: { files: fileList },
      target: { files: fileList },
    });

    await waitFor(() =>
      expect(
        screen.getByText("Select a file with an .xlsx filename."),
      ).toBeTruthy(),
    );
  });

  it("uploads, creates, and reports the new source", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      },
    });
    createFileUpload.mockResolvedValue({
      upload: { id: "upload_1" },
      uploadUrl: {
        headers: {},
        method: "PUT",
        url: "https://upload.example",
      },
    });
    completeFileUpload.mockResolvedValue({
      checksumSha256: "abc",
      createdAt: new Date("2026-06-08T00:00:00.000Z"),
      createdByUserId: "user_1",
      engine: "cached",
      engineVersion: null,
      fileId: "file_1",
      id: "file_1",
      inspection: null,
      name: "source.xlsx",
      originalName: "source.xlsx",
      ownerUserId: "user_1",
      status: "valid",
      updatedAt: new Date("2026-06-08T00:00:00.000Z"),
      validationError: null,
    });
    createWorkbook.mockResolvedValue({
      checksumSha256: "abc",
      createdAt: new Date("2026-06-08T00:00:00.000Z"),
      createdByUserId: "user_1",
      engine: "cached",
      engineVersion: null,
      fileId: "file_1",
      id: "workbook_1",
      inspection: null,
      name: "Q1 Workbook",
      originalName: "source.xlsx",
      ownerUserId: "user_1",
      status: "pending_validation",
      updatedAt: new Date("2026-06-08T00:00:00.000Z"),
      validationError: null,
    });

    render(<WorkbookUploadForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Source name"), "Q1 Workbook");
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File([new Uint8Array([1, 2, 3])], "source.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Create source" }));

    expect(createFileUpload).toHaveBeenCalled();
    expect(completeFileUpload).toHaveBeenCalledWith({ uploadId: "upload_1" });
    expect(createWorkbook).toHaveBeenCalledWith({
      fileId: "file_1",
      name: "Q1 Workbook",
    });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "workbook_1", name: "Q1 Workbook" }),
    );
  });

  it("reports upload failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      },
    });
    createFileUpload.mockResolvedValue({
      upload: { id: "upload_1" },
      uploadUrl: {
        headers: {},
        method: "PUT",
        url: "https://upload.example",
      },
    });

    render(<WorkbookUploadForm onCreated={() => {}} />);

    await user.type(screen.getByLabelText("Source name"), "Q1 Workbook");
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File([new Uint8Array([1, 2, 3])], "source.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Create source" }));

    expect(screen.getByText("File upload failed.")).toBeTruthy();
  });
});
