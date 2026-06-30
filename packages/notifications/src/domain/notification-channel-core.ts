export const NOTIFICATION_CHANNEL_REGISTRY = {
  question_generation_run: {
    access: "question_generation_run",
    frontendSubscription: "resource",
    idField: "questionGenerationRunId",
    prefix: "$question-generation-run",
  },
  question_set: {
    access: "question_set",
    frontendSubscription: "resource",
    idField: "questionSetId",
    prefix: "$question-set",
  },
  user: {
    access: "current_user",
    frontendSubscription: "connection",
    idField: "userId",
    prefix: "$user",
  },
  workbook_calculation: {
    access: "workbook_calculation",
    frontendSubscription: "resource",
    idField: "workbookCalculationId",
    prefix: "$workbook-calculation",
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

export type UuidValidator = (value: string) => boolean;

export function createNotificationChannelApi(isUuidString: UuidValidator) {
  function userNotificationChannel(userId: string): string {
    return buildNotificationChannel({ type: "user", userId });
  }

  function questionGenerationRunNotificationChannel(
    questionGenerationRunId: string,
  ): string {
    return buildNotificationChannel({
      questionGenerationRunId,
      type: "question_generation_run",
    });
  }

  function questionSetNotificationChannel(questionSetId: string): string {
    return buildNotificationChannel({ questionSetId, type: "question_set" });
  }

  function workbookCalculationNotificationChannel(
    workbookCalculationId: string,
  ): string {
    return buildNotificationChannel({
      type: "workbook_calculation",
      workbookCalculationId,
    });
  }

  function buildNotificationChannel(target: NotificationChannelTarget): string {
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

  function parseNotificationChannel(
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
          questionGenerationRunId: id,
          type: "question_generation_run",
        };
      case NOTIFICATION_CHANNEL_REGISTRY.question_set.prefix:
        return { questionSetId: id, type: "question_set" };
      case NOTIFICATION_CHANNEL_REGISTRY.workbook_calculation.prefix:
        return {
          type: "workbook_calculation",
          workbookCalculationId: id,
        };
      default:
        return null;
    }
  }

  function getNotificationChannelAccessRequirement(
    target: NotificationChannelTarget,
  ): NotificationChannelAccessRequirement {
    switch (target.type) {
      case "user":
        return { type: "current_user", userId: target.userId };
      case "question_generation_run":
        return {
          questionGenerationRunId: target.questionGenerationRunId,
          type: "question_generation_run",
        };
      case "question_set":
        return { questionSetId: target.questionSetId, type: "question_set" };
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

  return {
    buildNotificationChannel,
    getNotificationChannelAccessRequirement,
    parseNotificationChannel,
    questionGenerationRunNotificationChannel,
    questionSetNotificationChannel,
    userNotificationChannel,
    workbookCalculationNotificationChannel,
  };
}

function prefixFor(type: NotificationChannelType): string {
  return NOTIFICATION_CHANNEL_REGISTRY[type].prefix;
}
