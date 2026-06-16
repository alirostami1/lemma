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
  user: createUser(
    {
      id: "019e9315-6a87-715f-9861-8654df070e01",
      identityId: "keycloak-subject-user",
      email: "user@example.com",
      displayName: "User",
    },
    now,
  ),
  roles: [],
  at: now,
});
const otherUserId = "019e9315-6a87-715f-9861-8654df070e02";
const runId = "019e9315-6a87-715f-9861-8654df070e03";

describe("RealtimeAuthService", () => {
  it("signs subscription tokens with canonical channel and access requirement", async () => {
    const signedClaims: unknown[] = [];
    const accessRequirements: unknown[] = [];
    const service = new RealtimeAuthService({
      tokenSigner: {
        sign(input) {
          signedClaims.push(input.claims);
          return "signed-token";
        },
      },
      channelAccessPort: {
        async canSubscribe(input) {
          accessRequirements.push(input.accessRequirement);
          return true;
        },
      },
      clock: { now: () => now },
      tokenTtlSeconds: 60,
    });

    const channel = questionGenerationRunNotificationChannel(runId);
    const result = await service.createSubscriptionToken({
      currentUser,
      channel,
    });

    assert.equal(result.token, "signed-token");
    assert.deepEqual(accessRequirements, [
      { type: "question_generation_run", questionGenerationRunId: runId },
    ]);
    assert.deepEqual(signedClaims, [
      {
        sub: currentUser.user.id,
        channel,
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(result.expiresAt.getTime() / 1000),
      },
    ]);
  });

  it("does not sign a token for another user's channel", async () => {
    const signedClaims: unknown[] = [];
    const service = new RealtimeAuthService({
      tokenSigner: {
        sign(input) {
          signedClaims.push(input.claims);
          return "signed-token";
        },
      },
      channelAccessPort: {
        async canSubscribe(input) {
          return (
            input.accessRequirement.type === "current_user" &&
            input.accessRequirement.userId === input.currentUser.user.id
          );
        },
      },
      clock: { now: () => now },
      tokenTtlSeconds: 60,
    });

    await assert.rejects(
      () =>
        service.createSubscriptionToken({
          currentUser,
          channel: userNotificationChannel(otherUserId),
        }),
      ForbiddenNotificationChannelError,
    );
    assert.deepEqual(signedClaims, []);
  });

  it("does not sign a token when resource access is denied", async () => {
    const signedClaims: unknown[] = [];
    const service = new RealtimeAuthService({
      tokenSigner: {
        sign(input) {
          signedClaims.push(input.claims);
          return "signed-token";
        },
      },
      channelAccessPort: {
        async canSubscribe() {
          return false;
        },
      },
      clock: { now: () => now },
      tokenTtlSeconds: 60,
    });

    await assert.rejects(
      () =>
        service.createSubscriptionToken({
          currentUser,
          channel: questionGenerationRunNotificationChannel(runId),
        }),
      ForbiddenNotificationChannelError,
    );
    assert.deepEqual(signedClaims, []);
  });
});
