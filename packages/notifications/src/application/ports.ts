import type { JsonObject } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type {
  NotificationChannelAccessRequirement,
  NotificationChannelTarget,
} from "../domain/index.js";

export interface RealtimePublisherPort {
  publish(input: {
    channel: string;
    data: JsonObject;
    idempotencyKey?: string;
  }): Promise<void>;
}

export interface RealtimeTokenSignerPort {
  sign(input: { claims: JsonObject }): string;
}

export interface NotificationChannelAccessPort {
  canSubscribe(input: {
    currentUser: CurrentUser;
    channel: NotificationChannelTarget;
    accessRequirement: NotificationChannelAccessRequirement;
  }): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}
