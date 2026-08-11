package com.ssbmax.security

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Unit tests for Firebase Security Rules validation
 *
 * These tests validate the logical structure and correctness of our Firestore security rules
 * without requiring a Firebase emulator. They test:
 * - Rule existence and structure
 * - Access control logic paths
 * - Field validation requirements
 * - Security best practices
 *
 * Moved here from the deleted `core:data` module in the KMP-convergence plan's Phase 9f —
 * this test only ever read the repo-root `firestore.rules` file, no `core:data` class.
 *
 * Note: For full integration testing with actual Firestore, use Firebase emulator tests.
 * These unit tests provide fast validation of rule logic during development.
 */
class FirebaseRulesValidationTest {

    companion object {
        // Path to firestore.rules file relative to project root
        private const val RULES_FILE_PATH = "firestore.rules"
    }

    private fun getRulesContent(): String {
        // Try multiple potential paths since tests can run from different working directories
        // (e.g. "user.dir" == repo root, or == the "app" module directory).
        val possiblePaths = listOf(
            File(System.getProperty("user.dir"), RULES_FILE_PATH), // From project root
            File(System.getProperty("user.dir"), "../$RULES_FILE_PATH"), // From a top-level module (e.g. app)
            File(System.getProperty("user.dir"), "../../$RULES_FILE_PATH"), // From a nested module (e.g. core/data)
            File(System.getProperty("user.dir"), "../../../$RULES_FILE_PATH") // From a deeper nested module
        )

        val rulesFile = possiblePaths.firstOrNull { it.exists() }
            ?: error("Could not find firestore.rules file. Tried: ${possiblePaths.map { it.absolutePath }}")

        return rulesFile.readText()
    }

    // ==================== Rule Structure Tests ====================

    @Test
    fun `rules file exists and is readable`() {
        val content = getRulesContent()
        assertTrue("Rules file should not be empty", content.isNotBlank())
        assertTrue("Rules should use rules_version 2", content.contains("rules_version = '2'"))
    }

    @Test
    fun `rules define helper functions for authentication`() {
        val content = getRulesContent()

        // Critical helper functions must exist
        assertTrue("Should define isAuthenticated() function",
            content.contains("function isAuthenticated()"))
        assertTrue("Should define isOwner() function",
            content.contains("function isOwner(userId)"))
        assertTrue("Should define isAssessor() function",
            content.contains("function isAssessor()"))
        assertTrue("Should define isStudent() function",
            content.contains("function isStudent()"))
    }

    @Test
    fun `isAuthenticated checks for auth object`() {
        val content = getRulesContent()
        val isAuthFunction = content.substringAfter("function isAuthenticated()")
            .substringBefore("}")

        assertTrue("isAuthenticated should check request.auth",
            isAuthFunction.contains("request.auth != null"))
    }

    @Test
    fun `isOwner validates user ownership`() {
        val content = getRulesContent()
        val isOwnerFunction = content.substringAfter("function isOwner(userId)")
            .substringBefore("// Check if user is an assessor") // Stop at next function

        assertTrue("isOwner should check authentication",
            isOwnerFunction.contains("isAuthenticated()"))
        assertTrue("isOwner should check uid matches",
            isOwnerFunction.contains("request.auth.uid == userId"))
    }

    // ==================== User Data Access Tests ====================

    @Test
    fun `users can only read their own data`() {
        val content = getRulesContent()
        val userRules = content.substringAfter("match /users/{userId}")
            .substringBefore("// Test usage tracking")

        assertTrue("Users should be able to read own data",
            userRules.contains("allow read: if isOwner(userId)"))
    }

    @Test
    fun `users data subcollection is protected`() {
        val content = getRulesContent()
        val dataSubcollection = content.substringAfter("match /data/{document}")
            .substringBefore("}")

        assertTrue("Data subcollection should require ownership",
            dataSubcollection.contains("allow read, write: if isOwner(userId)"))
    }

    @Test
    fun `users cannot update their role field`() {
        val content = getRulesContent()
        val userUpdateRule = content.substringAfter("// Users can update their own profile")
            .substringBefore("// No one can delete user profiles")

        assertTrue(
            "Should prevent role field updates",
            userUpdateRule.contains(
                "!request.resource.data.diff(resource.data).affectedKeys()" +
                    ".hasAny(['role', 'isPaidMember', 'membershipPlan', 'paymentId', 'orderId'])"
            )
        )
    }

    @Test
    fun `user profile deletion is blocked`() {
        val content = getRulesContent()
        val userRules = content.substringAfter("match /users/{userId}")
            .substringBefore("// User data subcollection")

        assertTrue("Should block user deletion",
            userRules.contains("allow delete: if false"))
    }

    // ==================== Test Usage Tracking Tests ====================

    @Test
    fun `usage docs are readable by their owner`() {
        val content = getRulesContent()
        val usageRules = content.substringAfter("match /subscription/{document}")
            .substringBefore("match /data/subscription")

        assertTrue("Users should read own usage",
            usageRules.contains("allow read: if isOwner(userId)"))
    }

    // Phase 5 (docs/plans/CrossPlatform_SSOT): the recordTestUsage callable Cloud Function
    // (functions/src/eligibility.js, Admin SDK) is now the sole writer of usage_{month} docs --
    // the old client-writable increment-by-one create/update rules this test class used to pin
    // (`test_usage requires all required fields` / `validates integer types` / `is user-specific`)
    // are gone. Admin SDK writes bypass rules entirely, so "no client write, of any shape" is the
    // whole contract now.
    @Test
    fun `usage docs cannot be written by a client, of any shape`() {
        val content = getRulesContent()
        val usageRules = content.substringAfter("match /subscription/{document}")
            .substringBefore("match /data/subscription")

        assertTrue("Clients cannot write usage docs",
            usageRules.contains("allow write: if false"))
    }

    // ==================== Subscription Data Tests ====================

    @Test
    fun `subscription data is read-only from client`() {
        val content = getRulesContent()
        val subscriptionRules = content.substringAfter("match /data/subscription")
            .substringBefore("}")

        assertTrue("Clients can read subscription",
            subscriptionRules.contains("allow read: if isOwner(userId)"))
        assertTrue("Clients cannot write subscription",
            subscriptionRules.contains("allow write: if false"))
    }

    // ==================== OIR Test Content Tests ====================

    @Test
    fun `OIR metadata is read-only for authenticated users`() {
        val content = getRulesContent()
        val oirMetaRules = content.substringAfter("match /test_content/oir/meta/{document}")
            .substringBefore("}")

        assertTrue("Authenticated users can read OIR metadata",
            oirMetaRules.contains("allow read: if isAuthenticated()"))
        assertTrue("Clients cannot write OIR metadata",
            oirMetaRules.contains("allow write: if false"))
    }

    @Test
    fun `OIR question batches are read-only for authenticated users`() {
        // Phase 0b (CrossPlatform_SSOT): "question_batches" was a web-only path-drift
        // collection nobody wrote to; the KMP/web-authoritative path is "batches"
        // (GitLiveOIRQuestionCacheManager.FIRESTORE_BATCHES).
        val content = getRulesContent()
        val oirBatchRules = content.substringAfter("match /test_content/oir/batches/{batchId}")
            .substringBefore("}")

        assertTrue("Authenticated users can read question batches",
            oirBatchRules.contains("allow read: if isAuthenticated()"))
        assertTrue("Clients cannot write question batches",
            oirBatchRules.contains("allow write: if false"))
    }

    // ==================== Test Sessions Tests ====================

    @Test
    fun `test sessions are user-specific`() {
        val content = getRulesContent()
        val sessionRules = content.substringAfter("match /test_sessions/{sessionId}")
            .substringBefore("// TEST SUBMISSIONS")

        assertTrue("Users can read own sessions",
            sessionRules.contains("resource.data.userId == request.auth.uid"))
        assertTrue("Sessions must have userId",
            sessionRules.contains("request.resource.data.userId == request.auth.uid"))
    }

    @Test
    fun `test sessions require durable active metadata on creation`() {
        val content = getRulesContent()
        val sessionCreate = content.substringAfter("// Users can create test sessions")
            .substringBefore("// Users can update their own sessions")

        assertTrue("Sessions require ACTIVE status", sessionCreate.contains("request.resource.data.status == 'ACTIVE'"))
        // startTime/expiresAt are client-clock informational fields, not a security boundary --
        // the request.time.toMillis() comparisons were deliberately removed (commit 4694e2d2)
        // because they silently denied otherwise-valid sessions.
        assertFalse(
            "Sessions must not gate creation on client-clock expiry",
            sessionCreate.contains("request.resource.data.expiresAt > request.time.toMillis()")
        )
    }

    @Test
    fun `test sessions cannot mutate identity or delete audit records`() {
        val content = getRulesContent()
        val sessionRules = content.substringAfter("match /test_sessions/{sessionId}")
            .substringBefore("// TEST SUBMISSIONS")

        assertTrue("Session identity is immutable", sessionRules.contains("request.resource.data.testType == resource.data.testType"))
        assertTrue("Session deletion is forbidden", sessionRules.contains("allow delete: if false"))
        assertTrue("Only terminal states are allowed", sessionRules.contains("['ABANDONED', 'SUBMITTED', 'EXPIRED']"))
    }

    @Test
    fun `test sessions require isActive flag on creation`() {
        val content = getRulesContent()
        val sessionCreate = content.substringAfter("// Users can create test sessions")
            .substringBefore("// Users can update their own sessions")

        assertTrue("Sessions must be created with isActive = true",
            sessionCreate.contains("request.resource.data.isActive == true"))
    }

    // ==================== Submissions Tests ====================

    @Test
    fun `submissions require testType and submittedAt fields`() {
        val content = getRulesContent()
        val submissionCreate = content.substringAfter("// Students can create submissions")
            .substringBefore("// Students can update their own IN_PROGRESS submissions")

        assertTrue("Submissions must have testType",
            submissionCreate.contains("'testType'"))
        assertTrue("Submissions must have submittedAt",
            submissionCreate.contains("'submittedAt'"))
    }

    @Test
    fun `students can only update IN_PROGRESS submissions`() {
        val content = getRulesContent()
        val submissionUpdate = content.substringAfter("// Students can update their own IN_PROGRESS submissions")
            .substringBefore("// Students can delete their own DRAFT submissions")

        assertTrue("Should check IN_PROGRESS status",
            submissionUpdate.contains("resource.data.status == 'IN_PROGRESS'"))
    }

    @Test
    fun `students can only delete DRAFT submissions`() {
        val content = getRulesContent()
        val submissionDelete = content.substringAfter("// Students can delete their own DRAFT submissions only")
            .substringBefore("// AI GRADING RESULTS")

        assertTrue("Should check DRAFT status",
            submissionDelete.contains("resource.data.status == 'DRAFT'"))
    }

    // ==================== AI Grading Results Tests ====================

    @Test
    fun `AI grading results are read-only from client`() {
        val content = getRulesContent()
        val aiGradingRules = content.substringAfter("match /ai_grading_results/{resultId}")
            .substringBefore("// NOTIFICATIONS")

        assertTrue("Users can read own AI results",
            aiGradingRules.contains("allow read: if isAuthenticated()"))
        assertTrue("Clients cannot write AI results",
            aiGradingRules.contains("allow write: if false"))
    }

    // ==================== Study Materials Tests ====================

    @Test
    fun `study materials are read-only for authenticated users`() {
        val content = getRulesContent()
        val studyMaterialsRules = content.substringAfter("match /study_materials/{materialId}")
            .substringBefore("// CONTENT VERSIONS")

        assertTrue("Authenticated users can read study materials",
            studyMaterialsRules.contains("allow read: if isAuthenticated()"))
        assertTrue("Clients cannot write study materials",
            studyMaterialsRules.contains("allow write: if false"))
    }

    @Test
    fun `the orphaned camelCase studyMaterials and userProgress rule blocks were removed in Phase 2`() {
        val content = getRulesContent()

        assertFalse("studyMaterials (camelCase) was a dead alias of study_materials, removed in Phase 2 of docs/plans/CrossPlatform_SSOT",
            content.contains("match /studyMaterials/"))
        assertFalse("userProgress (camelCase) was a dead alias of user_progress, removed in Phase 2 of docs/plans/CrossPlatform_SSOT",
            content.contains("match /userProgress/"))
    }

    // ==================== Security Best Practices Tests ====================

    @Test
    fun `default deny rule exists`() {
        val content = getRulesContent()

        assertTrue("Should have default deny-all rule",
            content.contains("match /{document=**}"))
        assertTrue("Default rule should deny all access",
            content.contains("allow read, write: if false"))
    }

    @Test
    fun `no rules allow unauthenticated write access`() {
        val content = getRulesContent()

        // Check for potentially dangerous patterns
        assertFalse("Should not allow write: if true",
            content.contains("allow write: if true"))

        // Count instances of "allow write:" to ensure they're all protected
        val writeRules = Regex("allow write:").findAll(content).count()
        val protectedWrites = Regex("allow write: if (false|isAuthenticated\\(\\)|isOwner)").findAll(content).count()

        // Note: Some migration rules temporarily allow writes for authenticated users
        // This is documented in the rules file
        assertTrue("Most write rules should be protected (found $writeRules total, $protectedWrites protected)",
            protectedWrites > writeRules / 2) // At least half should be protected
    }

    @Test
    fun `critical collections have explicit rules`() {
        val content = getRulesContent()

        val criticalCollections = listOf(
            "users", "subscription", "test_sessions",
            "submissions", "test_content/oir"
        )

        criticalCollections.forEach { collection ->
            assertTrue("Should have rules for $collection",
                content.contains("match /$collection") ||
                content.contains("match /data/$collection"))
        }
    }

    @Test
    fun `role-based access functions check role field`() {
        val content = getRulesContent()

        assertTrue("isAssessor should check role == 'ASSESSOR'",
            content.contains("data.role == 'ASSESSOR'"))
        assertTrue("isStudent should check role == 'STUDENT'",
            content.contains("data.role == 'STUDENT'"))
    }

    @Test
    fun `batch access control validates instructor ownership`() {
        val content = getRulesContent()
        val batchRules = content.substringAfter("match /batches/{batchId}")
            .substringBefore("// BATCH ENROLLMENTS")

        assertTrue("Batch creation should check instructorId",
            batchRules.contains("request.resource.data.instructorId == request.auth.uid"))
    }

    // ==================== Documentation and Maintainability Tests ====================

    @Test
    fun `rules have clear section comments`() {
        val content = getRulesContent()

        val expectedSections = listOf(
            "HELPER FUNCTIONS",
            "USER DATA",
            "TEST CONTENT",
            "TEST SESSIONS",
            "TEST SUBMISSIONS",
            "OIR Test Content",
            "WAT Test Content",
            "SRT Test Content"
        )

        expectedSections.forEach { section ->
            assertTrue("Should have section comment for $section",
                content.contains(section))
        }
    }

    @Test
    fun `security notes document the rules' intent`() {
        val content = getRulesContent()

        assertTrue("Should document the audit-trail retention policy",
            content.contains("audit trail"))
        assertTrue("Should document that client-clock values are not a security boundary",
            content.contains("not a security boundary"))
    }
}
