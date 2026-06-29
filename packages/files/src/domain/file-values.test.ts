import assert from "node:assert/strict";
import test from "node:test";
import { filePurpose } from "./index.js";

test("accepts workbook editor output as a file purpose", () => {
  assert.equal(filePurpose("workbook_editor_output"), "workbook_editor_output");
});
