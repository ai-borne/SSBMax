package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.InstructorProfile
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.StudentProfile
import com.ssbmax.shared.domain.model.UserRole
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlin.time.Clock

/**
 * GitLive-Firebase-backed port of the Android FirestoreUserRepository.
 * Same Firestore path (users/{userId}, a top-level document — distinct from
 * UserProfile's users/{userId}/data/profile path handled by
 * GitLiveUserProfileRepository) and same field set (see UserDto.kt).
 * Uses DocumentReference.snapshots (a Flow) in place of the Android SDK's
 * addSnapshotListener/callbackFlow, same as the other Gitlive*Repository ports.
 */
class GitLiveUserRepository {

    private fun userDoc(userId: String) = Firebase.firestore
        .collection(SsbContracts.FirestorePaths.USERS)
        .document(userId)

    suspend fun saveUser(user: SSBMaxUser): Result<Unit> {
        return try {
            userDoc(user.id).set(user.toDto())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to save user: ${e.message}", e))
        }
    }

    suspend fun getUser(userId: String): Result<SSBMaxUser?> {
        return try {
            val snapshot = userDoc(userId).get()
            val user = if (snapshot.exists) snapshot.data(UserDto.serializer()).toDomain() else null
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to get user: ${e.message}", e))
        }
    }

    suspend fun getUserByEmail(email: String): Result<SSBMaxUser?> {
        return try {
            val querySnapshot = Firebase.firestore
                .collection(SsbContracts.FirestorePaths.USERS)
                .where { "email" equalTo email }
                .limit(1)
                .get()

            val user = querySnapshot.documents.firstOrNull()
                ?.data(UserDto.serializer())
                ?.toDomain()
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to get user by email: ${e.message}", e))
        }
    }

    fun observeUser(userId: String): Flow<SSBMaxUser?> =
        userDoc(userId).snapshots
            .map { snapshot -> if (snapshot.exists) snapshot.data(UserDto.serializer()).toDomain() else null }
            .catch { emit(null) }

    suspend fun updateUserRole(userId: String, role: UserRole): Result<Unit> {
        return try {
            userDoc(userId).update("role" to role.name)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to update user role: ${e.message}", e))
        }
    }

    suspend fun updateLastLogin(userId: String): Result<Unit> {
        return try {
            userDoc(userId).update("lastLoginAt" to Clock.System.now().toEpochMilliseconds())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to update last login: ${e.message}", e))
        }
    }

    suspend fun updateStudentProfile(userId: String, profile: StudentProfile): Result<Unit> {
        return try {
            userDoc(userId).update("studentProfile" to profile.toDtoMap())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to update student profile: ${e.message}", e))
        }
    }

    suspend fun updateInstructorProfile(userId: String, profile: InstructorProfile): Result<Unit> {
        return try {
            userDoc(userId).update("instructorProfile" to profile.toDtoMap())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to update instructor profile: ${e.message}", e))
        }
    }

    suspend fun deleteUser(userId: String): Result<Unit> {
        return try {
            userDoc(userId).delete()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to delete user: ${e.message}", e))
        }
    }

}

private fun StudentProfile.toDtoMap(): Map<String, Any?> = mapOf(
    "userId" to userId,
    "currentBatchIds" to currentBatchIds,
    "totalTestsAttempted" to totalTestsAttempted,
    "totalStudyHours" to totalStudyHours,
    "currentStreak" to currentStreak,
    "longestStreak" to longestStreak,
    "achievements" to achievements
)

private fun InstructorProfile.toDtoMap(): Map<String, Any?> = mapOf(
    "userId" to userId,
    "specialization" to specialization,
    "batchesCreated" to batchesCreated,
    "totalStudents" to totalStudents,
    "totalTestsGraded" to totalTestsGraded,
    "averageGradingTime" to averageGradingTime,
    "rating" to rating,
    "bio" to bio,
    "certifications" to certifications
)
