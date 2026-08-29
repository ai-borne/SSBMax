package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.GoogleSignInData
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.StudentProfile
import com.ssbmax.shared.domain.model.UserRole
import com.ssbmax.shared.domain.repository.AuthRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseUser
import dev.gitlive.firebase.auth.GoogleAuthProvider
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.functions.functions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlin.time.Clock

/**
 * GitLive-Firebase-backed implementation, ported from the Android
 * AuthRepositoryImpl + FirestoreUserRepository pair (Phase 2).
 *
 * handleGoogleSignInResult does the real load-or-create-profile merge via
 * GitLiveUserRepository (users/{userId}) — closing the gap the Phase 0 report
 * flagged ("that's real business logic worth porting in Phase 2"). currentUser
 * is now reactive over Firebase.auth.authStateChanged joined with
 * GitLiveUserRepository.observeUser's Firestore snapshot listener — the same
 * shape as the Android original's callbackFlow-over-authState + Firestore
 * join, closing the gap Phase 0/2 previously left open. No app-wide
 * CoroutineScope singleton exists in this module's Koin graph yet (see
 * GitLiveOIRQuestionCacheManager's doc comment for the same precedent), so
 * this repository owns its own background scope, matching that pattern.
 *
 * A real Google ID token exchange (Android Credential Manager / iOS
 * GoogleSignIn SDK) is NOT wired here — GoogleSignInData carries an
 * (idToken, accessToken) pair by convention for this spike; obtaining that
 * pair from a native picker is platform UI work out of Phase 0 scope.
 */
class GitLiveAuthRepository(
    private val userRepository: GitLiveUserRepository = GitLiveUserRepository()
) : AuthRepository {

    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    override val currentUser: StateFlow<SSBMaxUser?> = Firebase.auth.authStateChanged
        .flatMapLatest { firebaseUser ->
            if (firebaseUser == null) flowOf(null) else userRepository.observeUser(firebaseUser.uid)
        }
        .catch { emit(null) }
        .stateIn(
            scope = repositoryScope,
            started = SharingStarted.WhileSubscribed(stopTimeoutMillis = 5_000L),
            initialValue = null
        )

    // Email/password auth is not implemented in the Android app either (always
    // Result.failure there) — Google Sign-In is the only real flow. Matched here
    // rather than left unimplemented, since GitLiveAuthRepository must satisfy the
    // full real AuthRepository interface after the Phase 1 domain move.
    override suspend fun signIn(email: String, password: String): Result<SSBMaxUser> {
        return Result.failure(UnsupportedOperationException("Email/password sign-in is not supported"))
    }

    override suspend fun signUp(email: String, password: String, displayName: String): Result<SSBMaxUser> {
        return Result.failure(UnsupportedOperationException("Email/password sign-up is not supported"))
    }

    // Real Google ID token exchange (Android Credential Manager / iOS GoogleSignIn SDK)
    // is out of Phase 0/1 scope (see class doc comment) — this placeholder LaunchData
    // is not wired to a real platform picker yet.
    override fun getGoogleSignInIntent(): GoogleSignInData.LaunchData {
        return GoogleSignInData.LaunchData(Unit)
    }

    override suspend fun updateUserRole(role: UserRole): Result<Unit> {
        val userId = Firebase.auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("No authenticated user"))
        // No manual currentUser patch needed -- observeUser's Firestore snapshot
        // listener picks up this write and pushes it through automatically.
        return userRepository.updateUserRole(userId, role)
    }

    override suspend fun handleGoogleSignInResult(data: GoogleSignInData): Result<SSBMaxUser> {
        return try {
            val tokens = data as? GoogleSignInData.ResultData
                ?: return Result.failure(Exception("Expected GoogleSignInData.ResultData"))

            val tokenPair = @Suppress("UNCHECKED_CAST") (tokens.platformData as? Pair<String, String?>)
                ?: return Result.failure(Exception("Missing Google ID token"))
            val (idToken, accessToken) = tokenPair

            val credential = GoogleAuthProvider.credential(idToken, accessToken)
            val authResult = Firebase.auth.signInWithCredential(credential)
            val firebaseUser = authResult.user
                ?: return Result.failure(Exception("Firebase user is null after sign-in"))

            // No manual currentUser patch needed -- authStateChanged + observeUser
            // pick this sign-in up and push the loaded/created profile through.
            loadOrCreateUserProfile(firebaseUser)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Ported from AuthRepositoryImpl.loadOrCreateUserProfile: an existing Firestore
     * user wins (with lastLoginAt refreshed), otherwise a fresh FREE-tier student
     * profile is created and saved — same fields, same defaults as the Android impl.
     */
    private suspend fun loadOrCreateUserProfile(firebaseUser: FirebaseUser): Result<SSBMaxUser> {
        val existingResult = userRepository.getUser(firebaseUser.uid)
        if (existingResult.isFailure) {
            return Result.failure(existingResult.exceptionOrNull() ?: Exception("Failed to load user"))
        }

        val existingUser = existingResult.getOrNull()
        if (existingUser != null) {
            userRepository.updateLastLogin(firebaseUser.uid)
            return Result.success(existingUser)
        }

        val newUser = firebaseUser.toDomainUser()
        val saveResult = userRepository.saveUser(newUser)
        if (saveResult.isFailure) {
            return Result.failure(saveResult.exceptionOrNull() ?: Exception("Failed to save new user"))
        }
        return Result.success(newUser)
    }

    override suspend fun signOut(): Result<Unit> {
        return try {
            // No manual currentUser patch needed -- authStateChanged emits null
            // as soon as Firebase's own sign-out completes.
            Firebase.auth.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // No cascade here -- functions/src/account/requestAccountDeletion.js only sets the
    // grace-period timestamp and disables the Auth account server-side. Never call
    // Firebase.auth.currentUser?.delete() client-side: that has no cascade and races the
    // scheduled purge (see root CLAUDE.md's four-consumer SSOT section).
    override suspend fun requestAccountDeletion(): Result<Unit> {
        return try {
            Firebase.functions.httpsCallable("requestAccountDeletion").invoke()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun cancelAccountDeletion(): Result<Unit> {
        return try {
            Firebase.functions.httpsCallable("cancelAccountDeletion").invoke()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun isAuthenticated(): Boolean {
        return Firebase.auth.currentUser != null
    }

    private fun FirebaseUser.toDomainUser(): SSBMaxUser = SSBMaxUser(
        id = uid,
        email = email ?: "",
        displayName = displayName ?: "User",
        photoUrl = photoURL,
        role = UserRole.STUDENT,
        studentProfile = StudentProfile(userId = uid),
        createdAt = Clock.System.now().toEpochMilliseconds(),
        lastLoginAt = Clock.System.now().toEpochMilliseconds()
    )
}
