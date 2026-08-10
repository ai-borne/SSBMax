package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlin.time.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.toLocalDateTime

/**
 * GitLive-Firebase-backed port of the Android UserProfileRepositoryImpl.
 * Stores user profiles under the same path (users/{userId}/data/profile).
 * Uses DocumentReference.snapshots (a Flow) in place of the Android SDK's
 * addSnapshotListener/callbackFlow — GitLive exposes the listener as a Flow
 * directly, so no manual awaitClose wiring is needed here.
 */
class GitLiveUserProfileRepository : UserProfileRepository {

    private fun profileDoc(userId: String) = Firebase.firestore
        .collection(SsbContracts.FirestorePaths.USERS)
        .document(userId)
        .collection(SsbContracts.FirestorePaths.USER_DATA_SUBCOLLECTION)
        .document(SsbContracts.FirestorePaths.USER_PROFILE_DOC_ID)

    override fun getUserProfile(userId: String): Flow<Result<UserProfile?>> =
        profileDoc(userId).snapshots
            .map<_, Result<UserProfile?>> { snapshot ->
                val profile = if (snapshot.exists) {
                    snapshot.data(UserProfileDto.serializer()).toDomain()
                } else {
                    null
                }
                Result.success(profile)
            }
            .catch { emit(Result.failure(it)) }

    override suspend fun saveUserProfile(profile: UserProfile): Result<Unit> {
        return try {
            profileDoc(profile.userId).set(profile.toDto())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateUserProfile(profile: UserProfile): Result<Unit> {
        return try {
            val updated = profile.copy(updatedAt = Clock.System.now().toEpochMilliseconds())
            profileDoc(updated.userId).set(updated.toDto())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun hasCompletedProfile(userId: String): Flow<Boolean> =
        profileDoc(userId).snapshots
            .map { snapshot ->
                if (!snapshot.exists) return@map false
                snapshot.data(UserProfileDto.serializer()).toDomain().isProfileComplete()
            }
            .catch { emit(false) }

    override suspend fun updateLoginStreak(userId: String): Result<Int> {
        return try {
            val docRef = profileDoc(userId)
            val snapshot = docRef.get()
            if (!snapshot.exists) {
                return Result.failure(Exception("User profile not found"))
            }

            val current = snapshot.data(UserProfileDto.serializer()).toDomain()
            val now = Clock.System.now().toEpochMilliseconds()
            val todayStart = todayStartMillis(now)
            val yesterdayStart = todayStart - DAY_MILLIS
            val lastLogin = current.lastLoginDate

            val newStreak = when {
                lastLogin == null -> 1
                lastLogin >= todayStart -> current.currentStreak
                lastLogin >= yesterdayStart -> current.currentStreak + 1
                else -> 1
            }
            val newLongestStreak = maxOf(current.longestStreak, newStreak)

            docRef.update(
                "currentStreak" to newStreak,
                "lastLoginDate" to now,
                "longestStreak" to newLongestStreak,
                "updatedAt" to now
            )
            Result.success(newStreak)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Local-timezone midnight, matching the Android impl's Calendar.getInstance()
    // (device-default timezone) -- NOT UTC epoch-day midnight. A pure `now % DAY_MILLIS`
    // calculation would shift the streak's day boundary by the device's UTC offset,
    // e.g. counting a just-after-midnight IST login as still "yesterday" until 5:30am UTC.
    internal fun todayStartMillis(nowEpochMillis: Long): Long {
        val tz = TimeZone.currentSystemDefault()
        val today = Instant.fromEpochMilliseconds(nowEpochMillis).toLocalDateTime(tz).date
        return today.atStartOfDayIn(tz).toEpochMilliseconds()
    }

    private companion object {
        const val DAY_MILLIS = 24L * 60 * 60 * 1000
    }
}
