import { isUuidString } from "@lemma/domain";

export const NOTIFICATION_CHANNEL_REGISTRY = {
  user: {
    prefix: "$user",
    idField: "userId",
    access: "current_user",
    frontendSubscription: "connection",
  },
  question_generation_run: {
    prefix: "$question-generation-run",
    idField: "questionGenerationRunId",
    access: "question_generation_run",
    frontendSubscription: "resource",
  },
  question_set: {
    prefix: "$question-set",
    idField: "questionSetId",
    access: "question_set",
    frontendSubscription: "resource",
  },
  workbook_calculation: {
    prefix: "$workbook-calculation",
    idField: "workbookCalculationId",
    access: "workbook_calculation",
    frontendSubscription: "resource",
  },
} as const;

export type NotificationChannelType =
  keyof typeof NOTIFICATION_CHANNEL_REGISTRY;

export type NotificationChannelTarget =
  | { type: "user"; userId: string }
  | {
      type: "question_generation_run";
      questionGenerationRunId: string;
    }
  | { type: "question_set"; questionSetId: string }
  | {
      type: "workbook_calculation";
      workbookCalculationId: string;
    };

export type NotificationChannelAccessRequirement =
  | { type: "current_user"; userId: string }
  | {
      type: "question_generation_run";
      questionGenerationRunId: string;
    }
  | { type: "question_set"; questionSetId: string }
  | {
      type: "workbook_calculation";
      workbookCalculationId: string;
    };

export function userNotificationChannel(userId: string): string {
  return buildNotificationChannel({ type: "user", userId });
}

export function questionGenerationRunNotificationChannel(
  questionGenerationRunId: string,
): string {
  return buildNotificationChannel({
    type: "question_generation_run",
    questionGenerationRunId,
  });
}

export function questionSetNotificationChannel(questionSetId: string): string {
  return buildNotificationChannel({ type: "question_set", questionSetId });
}

export function workbookCalculationNotificationChannel(
  workbookCalculationId: string,
): string {
  return buildNotificationChannel({
    type: "workbook_calculation",
    workbookCalculationId,
  });
}

export function buildNotificationChannel(
  target: NotificationChannelTarget,
): string {
  switch (target.type) {
    case "user":
      assertChannelId(target.userId, "userId");
      return `${prefixFor("user")}:${target.userId}`;
    case "question_generation_run": {
      assertChannelId(
        target.questionGenerationRunId,
        "questionGenerationRunId",
      );
      const prefix = prefixFor("question_generation_run");
      return `${prefix}:${target.questionGenerationRunId}`;
    }
    case "question_set":
      assertChannelId(target.questionSetId, "questionSetId");
      return `${prefixFor("question_set")}:${target.questionSetId}`;
    case "workbook_calculation": {
      assertChannelId(target.workbookCalculationId, "workbookCalculationId");
      const prefix = prefixFor("workbook_calculation");
      return `${prefix}:${target.workbookCalculationId}`;
    }
  }
}

export function parseNotificationChannel(
  channel: string,
): NotificationChannelTarget | null {
  const [prefix, id, ...rest] = channel.split(":");
  if (!prefix || !id || rest.length > 0 || !isUuidString(id)) {
    return null;
  }
  switch (prefix) {
    case NOTIFICATION_CHANNEL_REGISTRY.user.prefix:
      return { type: "user", userId: id };
    case NOTIFICATION_CHANNEL_REGISTRY.question_generation_run.prefix:
      return {
        type: "question_generation_run",
        questionGenerationRunId: id,
      };
    case NOTIFICATION_CHANNEL_REGISTRY.question_set.prefix:
      return { type: "question_set", questionSetId: id };
    case NOTIFICATION_CHANNEL_REGISTRY.workbook_calculation.prefix:
      return {
        type: "workbook_calculation",
        workbookCalculationId: id,
      };
    default:
      return null;
  }
}

export function getNotificationChannelAccessRequirement(
  target: NotificationChannelTarget,
): NotificationChannelAccessRequirement {
  switch (target.type) {
    case "user":
      return { type: "current_user", userId: target.userId };
    case "question_generation_run":
      return {
        type: "question_generation_run",
        questionGenerationRunId: target.questionGenerationRunId,
      };
    case "question_set":
      return { type: "question_set", questionSetId: target.questionSetId };
    case "workbook_calculation":
      return {
        type: "workbook_calculation",
        workbookCalculationId: target.workbookCalculationId,
      };
  }
}

function assertChannelId(value: string, fieldName: string): void {
  if (!isUuidString(value)) {
    throw new TypeError(`${fieldName} must be a supported UUID string.`);
  }
}

function prefixFor(type: NotificationChannelType): string {
  return NOTIFICATION_CHANNEL_REGISTRY[type].prefix;
}
