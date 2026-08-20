/**
 * Notification bell + inbox copy (Phase 6, Centralized Result-Announcement
 * Notifications plan). Parity counterpart of KMP's hardcoded strings in
 * `NotificationCenterViewModel.kt`/its Compose screen -- Tier 3, hand-kept in sync.
 */
export const notificationStrings = {
  bellLabel: 'Notifications',
  inboxTitle: 'Notifications',
  markAllRead: 'Mark all read',
  emptyTitle: 'No notifications yet',
  emptyBody: "You'll see your result-ready alerts here.",
  errorLoading: 'Could not load notifications',
  signInRequired: 'Sign in to view notifications',
  permissionPromptTitle: 'Get notified when results are ready',
  permissionPromptBody: "Turn on push notifications so you don't have to keep checking back.",
  permissionEnable: 'Enable notifications',
  permissionDismiss: 'Not now',
  permissionDenied: 'Notifications are blocked in your browser settings.',
  permissionUnsupported: 'Push notifications are not supported in this browser.',
  permissionError: 'Could not enable notifications. Please try again.'
} as const;
