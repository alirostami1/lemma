import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertUuidV7, isUuidV7 } from "./index.js";

const uuidV7 = "019e9315-6a87-715f-9861-8654df070c4c";
const uuidV4 = "2dfb8d1e-9b7c-4b2c-80ac-1f2fae7a9f76";

describe("UUIDv7 validation", () => {
  it("accepts UUIDv7 values and trims surrounding whitespace", () => {
    assert.equal(isUuidV7(uuidV7), true);
    assert.equal(assertUuidV7(` ${uuidV7} `, "fileId"), uuidV7);
  });

  it("rejects UUIDv4 and malformed values", () => {
    assert.equal(isUuidV7(uuidV4), false);
    assert.throws(
      () => assertUuidV7(uuidV4, "fileId"),
      /fileId must be a valid UUIDv7\./,
    );
    assert.throws(
      () => assertUuidV7("not-a-uuid", "fileId"),
      /fileId must be a valid UUIDv7\./,
    );
  });
});
