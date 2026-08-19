package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock

/**
 * GitLive-Firebase-backed port of the Android SubscriptionRepositoryImpl.
 * Same Firestore paths (users/{userId}/data/subscription for tier,
 * users/{userId}/subscription/usage_{month} for usage counts); the per-test
 * limit table moves to SubscriptionLimits (SubscriptionDtos.kt) instead of
 * being re-inlined here.
 *
 * Read-only with respect to `data/subscription`: the old `updateSubscriptionTier` write was
 * removed in Phase 1 of the Payment Ecosystem Hardening plan (finding C1) and firestore.rules now
 * denies client writes to that document outright -- see [SubscriptionRepository] for the full
 * rationale. Only the payment webhooks (Admin SDK) write tier.
 */
class GitLiveSubscriptionRepository : SubscriptionRepository {

    override suspend fun getSubscriptionTier(userId: String): Result<SubscriptionTier> {
        return try {
            val snapshot = tierDoc(userId).get()
            val tier = if (snapshot.exists) {
                val dto = snapshot.data(SubscriptionTierDto.serializer())
                deriveEffectiveTier(dto.toDomain(), dto.expiryDate, Clock.System.now().toEpochMilliseconds())
            } else {
                SubscriptionTier.FREE
            }
            Result.success(tier)
        } catch (e: Exception) {
            Result.success(SubscriptionTier.FREE)
        }
    }

    override suspend fun getMonthlyUsage(userId: String, month: String): Result<Map<String, UsageInfo>> {
        return try {
            val snapshot = Firebase.firestore
                .collection(SsbContracts.FirestorePaths.USERS)
                .document(userId)
                .collection(SsbContracts.FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
                .document("usage_$month")
                .get()

            val usage = if (snapshot.exists) {
                snapshot.data(SubscriptionUsageDto.serializer())
            } else {
                SubscriptionUsageDto()
            }

            val tier = getSubscriptionTier(userId).getOrDefault(SubscriptionTier.FREE)
            val usedByKey = mapOf(
                "OIR" to usage.oirTestsUsed,
                "PPDT" to usage.ppdtTestsUsed,
                "PIQ" to usage.piqTestsUsed,
                "TAT" to usage.tatTestsUsed,
                "WAT" to usage.watTestsUsed,
                "SRT" to usage.srtTestsUsed,
                "SD" to usage.sdTestsUsed,
                "GTO" to usage.gtoTestsUsed,
                "INTERVIEW" to usage.interviewTestsUsed
            )

            val usageMap = usedByKey.mapValues { (key, used) ->
                UsageInfo(used = used, limit = SubscriptionLimits.limitFor(key, tier))
            }
            Result.success(usageMap)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to load monthly usage: ${e.message}", e))
        }
    }

    override suspend fun getSubscriptionStartDate(userId: String): Result<Long?> {
        return try {
            val snapshot = tierDoc(userId).get()
            val startDate = if (snapshot.exists) {
                snapshot.data(SubscriptionTierDto.serializer()).startDate.takeIf { it > 0 }
            } else {
                null
            }
            Result.success(startDate)
        } catch (e: Exception) {
            Result.success(null)
        }
    }

    override suspend fun getSubscriptionOwnership(userId: String): Result<SubscriptionOwnership> {
        return try {
            val snapshot = tierDoc(userId).get()
            val ownership = if (snapshot.exists) {
                val dto = snapshot.data(SubscriptionTierDto.serializer())
                SubscriptionOwnership(source = dto.source, expiryDate = dto.expiryDate, willRenew = dto.willRenew)
            } else {
                SubscriptionOwnership(source = null, expiryDate = null)
            }
            Result.success(ownership)
        } catch (e: Exception) {
            // Fail open (no restriction), not closed -- unlike tier reads, blocking a purchase on
            // a transient read error is worse than occasionally allowing one this gate would have
            // caught; the two payment paths still can't corrupt each other's core tier data.
            Result.success(SubscriptionOwnership(source = null, expiryDate = null))
        }
    }

    private fun tierDoc(userId: String) = Firebase.firestore
        .collection(SsbContracts.FirestorePaths.USERS)
        .document(userId)
        .collection(SsbContracts.FirestorePaths.USER_DATA_SUBCOLLECTION)
        .document(SsbContracts.FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)

}

/**
 * A stale/missed webhook must not leave an expired paid tier readable indefinitely -- derive the
 * effective tier from `expiryDate` at read time rather than trusting the stored `tier` field as-is.
 * `expiryDate == null` (legacy/grandfathered docs, e.g. pre-migration Razorpay one-time orders)
 * falls through to trusting the stored tier unchanged.
 */
internal fun deriveEffectiveTier(tier: SubscriptionTier, expiryDate: Long?, nowMillis: Long): SubscriptionTier =
    if (expiryDate != null && expiryDate < nowMillis) SubscriptionTier.FREE else tier
