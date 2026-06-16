import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { identityId, roleId, userId } from "./ids.js";

const uuidV7 = "019e9315-6a87-715f-9861-8654df070c4c";
const uuidV4 = "2dfb8d1e-9b7c-4b2c-80ac-1f2fae7a9f76";

describe("identity IDs", () => {
  it("accepts UUIDv7 internal app IDs", () => {
    assert.equal(userId(uuidV7), uuidV7);
    assert.equal(roleId(uuidV7), uuidV7);
  });

  it("rejects UUIDv4 and malformed internal app IDs", () => {
    for (const createId of [userId, roleId]) {
      assert.throws(() => createId(uuidV4), /must be a valid UUIDv7\./);
      assert.throws(() => createId("not-a-uuid"), /must be a valid UUIDv7\./);
    }
  });

  it("keeps Keycloak subject identity IDs opaque", () => {
    assert.equal(identityId("keycloak-subject-123"), "keycloak-subject-123");
  });
});
