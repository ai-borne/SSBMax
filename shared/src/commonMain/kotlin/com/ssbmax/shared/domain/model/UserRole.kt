package com.ssbmax.shared.domain.model

import kotlin.time.Clock

/**
 * User roles in the SSBMax platform
 */
enum class UserRole {
    STUDENT,
    INSTRUCTOR,
    BOTH; // User can switch between roles
    
    val isStudent: Boolean
        get() = this == STUDENT || this == BOTH
    
    val isInstructor: Boolean
        get() = this == INSTRUCTOR || this == BOTH
}

/**
 * Extended user model with role-based information
 */
data class SSBMaxUser(
    val id: String,
    val email: String,
    val displayName: String,
    val photoUrl: String? = null,
    val role: UserRole,
    val studentProfile: StudentProfile? = null,
    val instructorProfile: InstructorProfile? = null,
    val createdAt: Long = Clock.System.now().toEpochMilliseconds(),
    val lastLoginAt: Long = Clock.System.now().toEpochMilliseconds(),
    /**
     * Epoch millis of a pending account-deletion request (`users/{uid}.deletionRequestedAt`,
     * set by `functions/src/account/requestAccountDeletion.js`), or null when none is pending.
     * Not part of [com.ssbmax.shared.data.repository.UserDto] -- that DTO must stay Firebase-free
     * (root CLAUDE.md: `shared` carries no Firebase), so `data-firebase`'s GitLiveUserRepository
     * reads this field separately as a GitLive `Timestamp` and merges it in.
     */
    val deletionRequestedAt: Long? = null
)

/**
 * Student-specific profile information
 */
data class StudentProfile(
    val userId: String,
    val currentBatchIds: List<String> = emptyList(),
    val phase1Progress: PhaseProgress? = null,
    val phase2Progress: PhaseProgress? = null,
    val totalTestsAttempted: Int = 0,
    val totalStudyHours: Float = 0f,
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val achievements: List<String> = emptyList()
)

/**
 * Instructor-specific profile information
 */
data class InstructorProfile(
    val userId: String,
    val specialization: List<String> = emptyList(), // e.g., ["Psychology", "GTO"]
    val batchesCreated: List<String> = emptyList(),
    val totalStudents: Int = 0,
    val totalTestsGraded: Int = 0,
    val averageGradingTime: Long = 0, // in milliseconds
    val rating: Float = 0f,
    val bio: String? = null,
    val certifications: List<String> = emptyList()
)

