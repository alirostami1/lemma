import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FileNotFoundError,
  FileStorageObjectMismatchError,
  FileStorageProviderError,
  FileUploadExpiredError,
  FileUploadNotFoundError,
  InvalidFileStateError,
} from "@lemma/files/domain";
import {
  DraftSourceEditorUploadInvalidError,
  DraftSourceEditorUploadNotFoundError,
  DraftSourceEditorUploadStorageError,
  DraftSourceFileInvalidError,
} from "@lemma/questions/application";
import { mapDraftSourceFilePortError } from "./draft-source-file-port-errors.js";

describe("mapDraftSourceFilePortError", () => {
  it("maps missing editor uploads to questions-owned not found errors", () => {
    for (const error of [
      new FileUploadNotFoundError(),
      new FileNotFoundError(),
    ]) {
      const mapped = mapDraftSourceFilePortError(error, "editorUploadLookup");

      assert.ok(mapped instanceof DraftSourceEditorUploadNotFoundError);
    }
  });

  it("maps creation validation failures to questions-owned invalid errors", () => {
    const mapped = mapDraftSourceFilePortError(
      new InvalidFileStateError(),
      "editorUploadCreation",
    );

    assert.ok(mapped instanceof DraftSourceEditorUploadInvalidError);
  });

  it("maps invalid editor upload state and object mismatch to questions-owned invalid errors", () => {
    for (const error of [
      new FileUploadExpiredError(),
      new InvalidFileStateError(),
      new FileStorageObjectMismatchError(),
    ]) {
      const mapped = mapDraftSourceFilePortError(
        error,
        "editorUploadCompletion",
      );

      assert.ok(mapped instanceof DraftSourceEditorUploadInvalidError);
    }
  });

  it("maps storage provider failures to questions-owned storage errors", () => {
    for (const operation of [
      "editorUploadCreation",
      "editorUploadCompletion",
    ] as const) {
      const mapped = mapDraftSourceFilePortError(
        new FileStorageProviderError(),
        operation,
      );

      assert.ok(mapped instanceof DraftSourceEditorUploadStorageError);
    }
  });

  it("maps file lookup failures to source-file errors", () => {
    const mapped = mapDraftSourceFilePortError(
      new FileNotFoundError(),
      "editorFileLookup",
    );

    assert.ok(mapped instanceof DraftSourceFileInvalidError);
  });

  it("leaves unexpected errors unchanged", () => {
    const error = new Error("programmer error");

    const mapped = mapDraftSourceFilePortError(error, "editorUploadCompletion");

    assert.equal(mapped, error);
  });
});
