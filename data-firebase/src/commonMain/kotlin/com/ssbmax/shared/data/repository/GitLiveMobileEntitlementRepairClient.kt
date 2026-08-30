package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.MobileEntitlementRepairClient
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.functions.functions
import kotlinx.serialization.Serializable

@Serializable
private data class RepairMobileEntitlementRequest(val claimedTier: String)

/**
 * [MobileEntitlementRepairClient] backed by the `repairMobileEntitlement` Cloud Function
 * (`functions/src/subscriptions/repairMobileEntitlement.js`). Same GitLive `httpsCallable`
 * pattern as [GitLiveOIREvaluationClient] -- the signed-in user's Firebase Auth ID token is
 * attached automatically, which is what lets the server treat `context.auth.uid` as the
 * RevenueCat `app_user_id` to verify against (H4's identity-linking guarantee).
 */
class GitLiveMobileEntitlementRepairClient : MobileEntitlementRepairClient {

    override suspend fun repairEntitlement(claimedTier: SubscriptionTier): Result<Unit> = try {
        Firebase.functions.httpsCallable("repairMobileEntitlement")
            .invoke(RepairMobileEntitlementRequest(claimedTier = claimedTier.name))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
