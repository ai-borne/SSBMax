/**
 * DO NOT EDIT. Generated file — hand edits will be overwritten and are
 * caught by `npm run contracts:check` in CI / pre-commit.
 *
 * Source: firestore-paths.yaml, enums.yaml, subscription.yaml, test-config.yaml, events.yaml, routes.yaml (contracts/README.md documents the SSOT policy)
 * Regenerate: node scripts/generate-contracts.js
 *
 * SRP justification for exceeding the project 300-LOC limit: this file has
 * exactly one responsibility — mirror its YAML contract sources 1:1 into
 * this target language. Splitting it would break that 1:1 mapping. See
 * contracts/README.md "Generated-file LOC exemption".
 */

package com.ssbmax.shared.contracts

object SsbContracts {

    object FirestorePaths {
        const val SUBMISSIONS = "submissions"
        const val SUBMISSIONS_ARCHIVE_GROUP = "submissions"
        const val ARCHIVED_SUBMISSIONS = "archived_submissions"
        const val GTO_RESULTS = "gto_results"
        const val PPDT_RESULTS = "ppdt_results"
        const val INTERVIEW_SESSIONS = "interview_sessions"
        const val INTERVIEW_RESPONSES = "interview_responses"
        const val USERS = "users"
        const val STUDY_MATERIALS = "study_materials"
        const val TEST_CONTENT = "test_content"

        object TestContent {
            const val OIR_BATCHES = "test_content/oir/batches"
            const val OIR_META_CONFIG = "test_content/oir/meta/config"
            const val PPDT_BATCHES = "test_content/ppdt/image_batches"
            const val TAT_BATCHES = "test_content/tat/image_batches"
            const val WAT_BATCHES = "test_content/wat/word_batches"
            const val SRT_BATCHES = "test_content/srt/situation_batches"
            const val GTO_BATCHES = "test_content/gto/task_batches"
            const val GPE_BATCHES = "test_content/gto/scenarios/gpe/batches"
        }
    }

    object Enums {
        enum class TestType { OIR, PPDT, PIQ, TAT, WAT, SRT, SD, GTO_GD, GTO_GPE, GTO_PGT, GTO_GOR, GTO_HGT, GTO_LECTURETTE, GTO_IO, GTO_CT, IO }
        enum class TestPhase { PHASE_1, PHASE_2 }
        enum class TestStatus { NOT_ATTEMPTED, IN_PROGRESS, SUBMITTED_PENDING_REVIEW, GRADED, COMPLETED }
        enum class SubscriptionTier { FREE, PRO, PREMIUM }
        enum class OIRQuestionType { VERBAL_REASONING, NON_VERBAL_REASONING, NUMERICAL_ABILITY, SPATIAL_REASONING }
        enum class OLQ(val displayName: String, val category: String, val critical: Boolean) {
            EFFECTIVE_INTELLIGENCE("Effective Intelligence", "INTELLECTUAL", false),
            REASONING_ABILITY("Reasoning Ability", "INTELLECTUAL", true),
            ORGANIZING_ABILITY("Organizing Ability", "INTELLECTUAL", false),
            POWER_OF_EXPRESSION("Power of Expression", "INTELLECTUAL", false),
            SOCIAL_ADJUSTMENT("Social Adjustment", "SOCIAL", true),
            COOPERATION("Cooperation", "SOCIAL", true),
            SENSE_OF_RESPONSIBILITY("Sense of Responsibility", "SOCIAL", true),
            INITIATIVE("Initiative", "DYNAMIC", false),
            SELF_CONFIDENCE("Self Confidence", "DYNAMIC", false),
            SPEED_OF_DECISION("Speed of Decision", "DYNAMIC", false),
            INFLUENCE_GROUP("Ability to Influence Group", "DYNAMIC", false),
            LIVELINESS("Liveliness", "DYNAMIC", true),
            DETERMINATION("Determination", "CHARACTER", false),
            COURAGE("Courage", "CHARACTER", true),
            STAMINA("Stamina", "CHARACTER", false);
        }
        enum class OLQCategory { INTELLECTUAL, SOCIAL, DYNAMIC, CHARACTER }
    }

    data class SubscriptionLimit(val bucket: String, val testTypes: List<String>, val free: Int, val pro: Int, val premium: Int)
    object Subscription {
        val LIMITS: List<SubscriptionLimit> = listOf(
            SubscriptionLimit("OIR", listOf("OIR"), 1, 5, -1),
            SubscriptionLimit("PPDT", listOf("PPDT"), 1, 5, -1),
            SubscriptionLimit("PIQ", listOf("PIQ"), 1, -1, -1),
            SubscriptionLimit("TAT", listOf("TAT"), 0, 3, -1),
            SubscriptionLimit("WAT", listOf("WAT"), 0, 3, -1),
            SubscriptionLimit("SRT", listOf("SRT"), 0, 3, -1),
            SubscriptionLimit("SD", listOf("SD"), 0, 3, -1),
            SubscriptionLimit("GTO", listOf("GTO_GD", "GTO_GPE", "GTO_PGT", "GTO_GOR", "GTO_HGT", "GTO_LECTURETTE", "GTO_IO", "GTO_CT"), 0, 3, -1),
            SubscriptionLimit("INTERVIEW", listOf("IO"), 0, 1, 3)
        )
    }

    data class TestConfigEntry(val testType: String, val values: Map<String, Any>)
    object TestConfig {
        val ENTRIES: List<TestConfigEntry> = listOf(
            TestConfigEntry("OIR", mapOf("totalQuestions" to 50)),
            TestConfigEntry("PPDT", mapOf("viewingSeconds" to 30, "writingSeconds" to 240, "minChars" to 200, "maxChars" to 1500)),
            TestConfigEntry("TAT", mapOf("totalPictures" to 12, "blankCardSlideNumber" to 12, "viewingSeconds" to 30, "writingSeconds" to 240, "minChars" to 150, "maxChars" to 1500)),
            TestConfigEntry("WAT", mapOf("totalWords" to 60, "secondsPerWord" to 15, "totalSeconds" to 900)),
            TestConfigEntry("SRT", mapOf("totalSituations" to 60, "totalSeconds" to 1800)),
            TestConfigEntry("SD", mapOf("totalQuestions" to 4, "totalSeconds" to 900, "maxWordsPerQuestion" to 1000)),
            TestConfigEntry("GTO_GD", mapOf("totalSeconds" to 1200)),
            TestConfigEntry("GTO_GPE", mapOf("viewingSeconds" to 60, "planningSeconds" to 1740, "totalSeconds" to 1800)),
            TestConfigEntry("GTO_LECTURETTE", mapOf("speechSeconds" to 180)),
            TestConfigEntry("GTO_PGT", mapOf("totalSeconds" to 1800)),
            TestConfigEntry("GTO_HGT", mapOf("totalSeconds" to 900)),
            TestConfigEntry("GTO_GOR", mapOf("totalSeconds" to 1200)),
            TestConfigEntry("GTO_IO", mapOf("totalSeconds" to 1800)),
            TestConfigEntry("GTO_CT", mapOf("totalSeconds" to 900))
        )
    }

    object SecurityEvents {
        const val UNAUTHENTICATED_ACCESS = "sec_unauth_test_access"
        const val LIMIT_REACHED = "sec_limit_reached"
    }

    object Routes {
        const val MINIMUM_SUPPORTED_APP_VERSION = "1.0.0"
        const val SPLASH = "splash"
        const val LOGIN = "login"
        const val ROLE_SELECTION = "role_selection"
        const val STUDENT_HOME = "student/home"
        const val STUDENT_TESTS = "student/tests"
        const val STUDENT_SUBMISSIONS = "student/submissions"
        const val STUDENT_STUDY = "student/study"
        const val STUDENT_PROFILE = "student/profile"
        const val INSTRUCTOR_HOME = "instructor/home"
        const val INSTRUCTOR_STUDENTS = "instructor/students"
        const val INSTRUCTOR_GRADING = "instructor/grading"
        const val INSTRUCTOR_ANALYTICS = "instructor/analytics"
        const val INSTRUCTOR_STUDENT_DETAIL = "instructor/student/{studentId}"
        const val INSTRUCTOR_GRADING_DETAIL = "instructor/grading/{submissionId}"
        const val PHASE1_DETAIL = "phase1/detail"
        const val PHASE2_DETAIL = "phase2/detail"
        const val TEST_OIR = "test/oir/{testId}"
        const val TEST_OIR_RESULT = "test/oir/result/{submissionId}"
        const val TEST_OIR_REVIEW = "test/oir/review/{submissionId}"
        const val TEST_PPDT = "test/ppdt/{testId}"
        const val TEST_PPDT_RESULT = "test/ppdt/result/{submissionId}"
        const val TEST_TAT = "test/tat/{testId}"
        const val TEST_TAT_RESULT = "test/tat/result/{submissionId}"
        const val TEST_WAT = "test/wat/{testId}"
        const val TEST_WAT_RESULT = "test/wat/result/{submissionId}"
        const val TEST_SRT = "test/srt/{testId}"
        const val TEST_SRT_RESULT = "test/srt/result/{submissionId}"
        const val TEST_SD = "test/sd/{testId}"
        const val TEST_SD_RESULT = "test/sd/result/{submissionId}"
        const val TEST_PIQ = "test/piq/{testId}"
        const val TEST_PIQ_RESULT = "test/piq/result/{submissionId}"
        const val TEST_GTO = "test/gto/{testId}"
        const val TEST_GTO_GD = "test/gto/gd/{testId}"
        const val TEST_GTO_GD_RESULT = "test/gto/gd/result/{submissionId}"
        const val TEST_GTO_LECTURETTE = "test/gto/lecturette/{testId}"
        const val TEST_GTO_LECTURETTE_RESULT = "test/gto/lecturette/result/{submissionId}"
        const val TEST_GTO_GPE = "test/gto/gpe/{testId}"
        const val TEST_GTO_GPE_RESULT = "test/gto/gpe/result/{submissionId}"
        const val TEST_IO = "test/io/{testId}"
        const val INTERVIEW_START = "interview/start"
        const val INTERVIEW_VOICE = "interview/voice/{sessionId}"
        const val INTERVIEW_RESULT = "interview/result/{resultId}"
        const val STUDY_MATERIALS = "study/materials"
        const val STUDY_MATERIAL_CATEGORY = "study/material/{categoryId}"
        const val TOPIC_DETAIL = "topic/{topicId}"
        const val PREMIUM_UPGRADE = "premium/upgrade"
        const val NOTIFICATIONS_CENTER = "notifications/center"
        const val SETTINGS = "settings"
        const val SETTINGS_SUBSCRIPTION = "settings/subscription"
        const val ANALYTICS = "analytics"
        const val RESULTS_HISTORIC = "results/historic"
        const val USER_PROFILE = "user/profile"
        const val MARKETPLACE = "marketplace"
        const val SSB_OVERVIEW = "ssb/overview"
        const val FAQ = "faq"
        const val UPGRADE = "upgrade"
        const val PAYMENT = "payment"
        const val PAYMENT_SUCCESS = "payment/success"
        const val BATCH_JOIN = "batch/join"
        const val BATCH_CREATE = "batch/create"
        const val BATCH_DETAIL = "batch/{batchId}"
        const val SUBMISSION_DETAIL = "submission/{submissionId}"
    }
}
