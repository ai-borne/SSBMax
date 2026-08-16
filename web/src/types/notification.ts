/**
 * Web mirror of KMP's `shared/.../domain/model/Notification.kt` (Tier 3, no mechanical
 * enforcement -- hand-kept in sync). Field names match `SSBMaxNotificationDto` exactly, since
 * both write/read the same `notifications` Firestore collection.
 */
export type NotificationType =
  | 'GRADING_COMPLETE'
  | 'FEEDBACK_AVAILABLE'
  | 'BATCH_INVITATION'
  | 'GENERAL_ANNOUNCEMENT'
  | 'STUDY_REMINDER'
  | 'TEST_REMINDER'
  | 'MARKETPLACE_UPDATE';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface SSBMaxNotification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  imageUrl?: string | null;
  actionUrl?: string | null;
  actionData?: Record<string, string> | null;
  isRead: boolean;
  createdAt: number;
  expiresAt?: number | null;
}

export interface FCMToken {
  userId: string;
  token: string;
  deviceId: string;
  platform: 'android' | 'ios' | 'web';
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreferences {
  userId: string;
  enablePushNotifications: boolean;
  enableGradingNotifications: boolean;
  enableFeedbackNotifications: boolean;
  enableBatchInvitations: boolean;
  enableGeneralAnnouncements: boolean;
  enableStudyReminders: boolean;
  enableTestReminders: boolean;
  enableMarketplaceUpdates: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  updatedAt: number;
}

export function defaultNotificationPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    enablePushNotifications: true,
    enableGradingNotifications: true,
    enableFeedbackNotifications: true,
    enableBatchInvitations: true,
    enableGeneralAnnouncements: true,
    enableStudyReminders: true,
    enableTestReminders: true,
    enableMarketplaceUpdates: true,
    quietHoursEnabled: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    updatedAt: Date.now()
  };
}
