export type NotificationsApplicationCode =
  | "INVALID_NOTIFICATION_CHANNEL"
  | "FORBIDDEN_NOTIFICATION_CHANNEL";

export class NotificationsApplicationError extends Error {
  constructor(
    readonly applicationCode: NotificationsApplicationCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidNotificationChannelError extends NotificationsApplicationError {
  constructor() {
    super("INVALID_NOTIFICATION_CHANNEL", "Notification channel is invalid.");
  }
}

export class ForbiddenNotificationChannelError extends NotificationsApplicationError {
  constructor() {
    super(
      "FORBIDDEN_NOTIFICATION_CHANNEL",
      "You cannot subscribe to this notification channel.",
    );
  }
}
