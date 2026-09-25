/**
 * Phase 9 (Payment Ecosystem Hardening plan): copy for `SupportSubscriptionPage.tsx`, the
 * admin-only support lookup tool. Its own domain file rather than dumped into `common.ts` --
 * web/CLAUDE.md's own convention is a new file per new UI domain, and this is a fully new one.
 */
export const supportStrings = {
  title: 'Subscription Support Lookup',
  subtitle: 'Admin-only: joins the Firestore and RevenueCat state for one user so a support ticket can be answered without switching consoles.',
  userIdLabel: 'Firebase user ID (uid) or email',
  userIdPlaceholder: 'Enter a uid or email...',
  lookupButton: 'Look Up',
  looking: 'Looking up...',
  firestorePanel: 'Firestore (stored subscription)',
  revenueCatPanel: 'RevenueCat',
  alertsPanel: 'Recent Ops Alerts',
  sourceUnavailable: 'Unavailable -- lookup failed or credentials are not configured.',
  noAlerts: 'No ops alerts recorded for this user.',
  permissionDenied: 'Admin access required to use this tool.',
  userNotFound: 'No user found for that uid or email.',
  genericError: 'Lookup failed. Please try again.',
  legacyRazorpaySource: 'Written by the retired Razorpay web checkout (legacy doc). RevenueCat is the only writer now; the next RevenueCat event overwrites it.',
  legacyOrUnknownSource: 'Unrecognized or missing purchase source (legacy doc).',
  moreAlertsExist: 'More alerts exist for this user -- narrow the time range or check ops_alerts directly for the full history.'
} as const;
