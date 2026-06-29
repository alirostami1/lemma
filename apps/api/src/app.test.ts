import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FileNotFoundError,
  FileNotVisibleError,
  ForbiddenFileActionError,
  InvalidFileStateError,
} from "@lemma/files/domain";
import { isExpectedDraftSourceFileUnavailableError } from "./composition/draft-source-file-error-mapping.js";

describe("draft source file metadata unavailable mapping", () => {
  it("treats missing, invisible, and forbidden files as expected unavailable metadata", () => {
    assert.equal(
      isExpectedDraftSourceFileUnavailableError(new FileNotFoundError()),
      true,
    );
    assert.equal(
      isExpectedDraftSourceFileUnavailableError(new FileNotVisibleError()),
      true,
    );
    assert.equal(
      isExpectedDraftSourceFileUnavailableError(new ForbiddenFileActionError()),
      true,
    );
  });

  it("does not map invalid file state or unexpected errors to unavailable metadata", () => {
    assert.equal(
      isExpectedDraftSourceFileUnavailableError(new InvalidFileStateError()),
      false,
    );
    assert.equal(
      isExpectedDraftSourceFileUnavailableError(
        new Error("database unavailable"),
      ),
      false,
    );
  });
});
