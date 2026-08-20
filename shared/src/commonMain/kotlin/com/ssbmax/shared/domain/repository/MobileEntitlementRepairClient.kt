package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * Domain interface for the client-triggered half of mobile drift repair (Phase 7, Payment
 * Ecosystem Hardening plan).
 *
 * Razorpay's active subscriptions are cheaply enumerable server-side
 * (`functions/src/subscriptions/scheduledRazorpayDriftSweep.js`), so web needs no client-side
 * counterpart. RevenueCat has no equivalent cheap "all active subscribers" endpoint -- the RC SDK
 * already hands every device authoritative `CustomerInfo` on launch, so the device is the natural
 * place to *detect* "RevenueCat looks entitled to more than Firestore has on record."
 *
 * **This client is never trusted for the write.** [claimedTier] is diagnostic only -- the
 * `repairMobileEntitlement` Cloud Function re-reads the truth from RevenueCat's REST API
 * server-side for the caller's own uid and writes only what RevenueCat confirms. Trusting the
 * client's claim here would reintroduce finding C1 (Phase 1) through the back door -- see that
 * function's doc comment for the exact guard.
 *
 * Implemented by [com.ssbmax.shared.data.repository.GitLiveMobileEntitlementRepairClient].
 */
interface MobileEntitlementRepairClient {
    /**
     * @param claimedTier the tier the device's own (locally cached, `getCustomerInfo()`-sourced)
     * RevenueCat read reported -- used server-side ONLY to detect and alert on a claim RevenueCat
     * doesn't actually back, never to decide what gets written.
     */
    suspend fun repairEntitlement(claimedTier: SubscriptionTier): Result<Unit>
}
