package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.GoogleSignInData
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.UserRole
import kotlinx.coroutines.flow.StateFlow

/**
 * Repository interface for authentication
 * 
 * Platform-independent authentication abstraction that supports:
 * - Email/password authentication
 * - Google Sign-In (via platform-agnostic GoogleSignInData)
 * - User role management
 * - Authentication state observation
 */
interface AuthRepository {

    /**
     * Current authenticated user as StateFlow for lifecycle-aware collection
     */
    val currentUser: StateFlow<SSBMaxUser?>

    /**
     * Sign in with email and password
     */
    suspend fun signIn(email: String, password: String): Result<SSBMaxUser>

    /**
     * Sign up with email and password
     */
    suspend fun signUp(email: String, password: String, displayName: String): Result<SSBMaxUser>

    /**
     * Get Google Sign-In launch data for initiating sign-in flow
     * Returns platform-agnostic data that can be used to launch the sign-in UI
     */
    fun getGoogleSignInIntent(): GoogleSignInData.LaunchData

    /**
     * Handle Google Sign-In result after user completes sign-in
     * 
     * @param data Platform-agnostic result data from sign-in flow
     * @return Result containing authenticated user or error
     */
    suspend fun handleGoogleSignInResult(data: GoogleSignInData): Result<SSBMaxUser>

    /**
     * Update user role (Student or Instructor)
     */
    suspend fun updateUserRole(role: UserRole): Result<Unit>

    /**
     * Sign out current user
     */
    suspend fun signOut(): Result<Unit>

    /**
     * Request account deletion: server sets a grace-period timestamp and
     * disables the Auth account (`functions/src/account/requestAccountDeletion.js`).
     * The actual data cascade runs server-side after the grace period expires.
     */
    suspend fun requestAccountDeletion(): Result<Unit>

    /**
     * Cancel a pending account deletion within the grace period, re-enabling
     * the Auth account (`functions/src/account/cancelAccountDeletion.js`).
     */
    suspend fun cancelAccountDeletion(): Result<Unit>

    /**
     * Check if user is authenticated
     */
    suspend fun isAuthenticated(): Boolean
}
