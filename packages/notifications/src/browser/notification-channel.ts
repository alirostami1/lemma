import { isUuidString } from "@lemma/domain/browser";
import { createNotificationChannelApi } from "../domain/notification-channel-core.js";

export type {
  NotificationChannelAccessRequirement,
  NotificationChannelTarget,
  NotificationChannelType,
} from "../domain/notification-channel-core.js";

const notificationChannelApi = createNotificationChannelApi(isUuidString);

export const buildNotificationChannel =
  notificationChannelApi.buildNotificationChannel;
export const getNotificationChannelAccessRequirement =
  notificationChannelApi.getNotificationChannelAccessRequirement;
export const parseNotificationChannel =
  notificationChannelApi.parseNotificationChannel;
export const questionGenerationRunNotificationChannel =
  notificationChannelApi.questionGenerationRunNotificationChannel;
export const questionSetNotificationChannel =
  notificationChannelApi.questionSetNotificationChannel;
export const userNotificationChannel =
  notificationChannelApi.userNotificationChannel;
export const workbookCalculationNotificationChannel =
  notificationChannelApi.workbookCalculationNotificationChannel;
