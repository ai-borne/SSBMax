package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore

/**
 * GitLive-Firebase-backed port of the Android SubscriptionRepositoryImpl.
 * Same Firestore paths (users/{userId}/data/subscription for tier,
 * users/{userId}/subscription/usage_{month} for usage counts); the per-test
 * limit table moves to SubscriptionLimits (SubscriptionDtos.kt) instead of
 * being re-inlined here.
 */
class GitLiveSubscriptionRepository : SubscriptionRepository {

    override suspend fun getSubscriptionTier(userId: String): Result<SubscriptionTier> {
        return try {
            val snapshot = tierDoc(userId).get()
            val tier = if (snapshot.exists) {
                snapshot.data(SubscriptionTierDto.serializer()).toDomain()
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
                "OIR Tests" to usage.oirTestsUsed,
                "PPDT Tests" to usage.ppdtTestsUsed,
                "PIQ Forms" to usage.piqTestsUsed,
                "TAT Tests" to usage.tatTestsUsed,
                "WAT Tests" to usage.watTestsUsed,
                "SRT Tests" to usage.srtTestsUsed,
                "Self Description" to usage.sdTestsUsed,
                "GTO Tests" to usage.gtoTestsUsed,
                "Interview" to usage.interviewTestsUsed
            )

            val usageMap = usedByKey.mapValues { (key, used) ->
                UsageInfo(used = used, limit = SubscriptionLimits.limitFor(key, tier))
            }
            Result.success(usageMap)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to load monthly usage: ${e.message}", e))
        }
    }

    override suspend fun updateSubscriptionTier(userId: String, tier: SubscriptionTier): Result<Unit> {
        return try {
            tierDoc(userId).set(SubscriptionTierDto(tier = tier.name))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun tierDoc(userId: String) = Firebase.firestore
        .collection(SsbContracts.FirestorePaths.USERS)
        .document(userId)
        .collection(SsbContracts.FirestorePaths.USER_DATA_SUBCOLLECTION)
        .document(SsbContracts.FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)

}
