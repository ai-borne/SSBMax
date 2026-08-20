/**
 * Phase 9 (Payment Ecosystem Hardening plan): copy for `SupportSubscriptionPage.tsx`, the
 * admin-only support lookup tool. Its own domain file rather than dumped into `common.ts` --
 * web/CLAUDE.md's own convention is a new file per new UI domain, and this is a fully new one.
 */
export const supportStrings = {
  title: 'Subscription Support Lookup',
  subtitle: 'Admin-only: joins the Firestore, Razorpay, and RevenueCat state for one user so a support ticket can be answered without switching consoles.',
  userIdLabel: 'Firebase user ID (uid)',
  userIdPlaceholder: 'Enter a uid...',
  lookupButton: 'Look Up',
  looking: 'Looking up...',
  firestorePanel: 'Firestore (stored subscription)',
  razorpayPanel: 'Razorpay',
  revenueCatPanel: 'RevenueCat',
  alertsPanel: 'Recent Ops Alerts',
  noRazorpaySubscription: 'No Razorpay subscription on file for this user.',
  sourceUnavailable: 'Unavailable -- lookup failed or credentials are not configured.',
  noAlerts: 'No ops alerts recorded for this user.',
  permissionDenied: 'Admin access required to use this tool.',
  genericError: 'Lookup failed. Please try again.'
} as const;
