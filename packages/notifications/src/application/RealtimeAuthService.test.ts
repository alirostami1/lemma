import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  questionGenerationRunNotificationChannel,
  userNotificationChannel,
} from "../domain/index.js";
import { ForbiddenNotificationChannelError } from "./errors.js";
import { RealtimeAuthService } from "./RealtimeAuthService.js";

const now = new Date("2026-06-15T00:00:00.000Z");
const currentUser = createCurrentUser({
  at: now,
  roles: [],
  user: createUser(
    {
      displayName: "User",
      email: "user@example.com",
      id: "019e9315-6a87-715f-9861-8654df070e01",
      identityId: "keycloak-subject-user",
    },
    now,
  ),
});
const otherUserId = "019e9315-6a87-715f-9861-8654df070e02";
const runId = "019e9315-6a87-715f-9861-8654df070e03";

describe("RealtimeAuthService", () => {
  it("signs subscription tokens with canonical channel and access requirement", async () => {
    const signedClaims: unknown[] = [];
    const accessRequirements: unknown[] = [];
    const service = new RealtimeAuthService({
      channelAccessPort: {
        async canSubscribe(input) {
          accessRequirements.push(input.accessRequirement);
          return true;
        },
      },
      clock: { now: () => now },
      tokenSigner: {
        sign(input) {
          signedClaims.push(input.claims);
          return "signed-token";
        },
      },
      tokenTtlSeconds: 60,
    });

    const channel = questionGenerationRunNotificationChannel(runId);
    const result = await service.createSubscriptionToken({
      channel,
      currentUser,
    });

    assert.equal(result.token, "signed-token");
    assert.deepEqual(accessRequirements, [
      { questionGenerationRunId: runId, type: "question_generation_run" },
    ]);
    assert.deepEqual(signedClaims, [
      {
        channel,
        exp: Math.floor(result.expiresAt.getTime() / 1000),
        iat: Math.floor(now.getTime() / 1000),
        sub: currentUser.user.id,
      },
    ]);
  });

  it("does not sign a token for another user's channel", async () => {
    const signedClaims: unknown[] = [];
    const service = new RealtimeAuthService({
      channelAccessPort: {
        async canSubscribe(input) {
          return (
            input.accessRequirement.type === "current_user" &&
            input.accessRequirement.userId === input.currentUser.user.id
          );
        },
      },
      clock: { now: () => now },
      tokenSigner: {
        sign(input) {
          signedClaims.push(input.claims);
          return "signed-token";
        },
      },
      tokenTtlSeconds: 60,
    });

    await assert.rejects(
      () =>
        service.createSubscriptionToken({
          channel: userNotificationChannel(otherUserId),
          currentUser,
        }),
      ForbiddenNotificationChannelError,
    );
    assert.deepEqual(signedClaims, []);
  });

  it("does not sign a token when resource access is denied", async () => {
    const signedClaims: unknown[] = [];
    const service = new RealtimeAuthService({
      channelAccessPort: {
        async canSubscribe() {
          return false;
        },
      },
      clock: { now: () => now },
      tokenSigner: {
        sign(input) {
          signedClaims.push(input.claims);
          return "signed-token";
        },
      },
      tokenTtlSeconds: 60,
    });

    await assert.rejects(
      () =>
        service.createSubscriptionToken({
          channel: questionGenerationRunNotificationChannel(runId),
          currentUser,
        }),
      ForbiddenNotificationChannelError,
    );
    assert.deepEqual(signedClaims, []);
  });
});
