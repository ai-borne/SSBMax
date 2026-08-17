package com.ssbmax.navigation

import com.ssbmax.shared.domain.model.SSBMaxNotification

/**
 * Maps a graded-result notification to the real result destination for the tap handler in
 * StudyContentGraph.kt's `NotificationCenter` composable. Extracted to a pure function (rather
 * than inlined in the Compose `NavGraphBuilder` lambda) so the testType -> destination mapping is
 * unit-testable without a Compose test harness -- same shape as [DeepLinkParser] being a plain
 * testable object instead of living inside [com.ssbmax.shared.ui.DeepLinkEffect].
 *
 * Keyed off `actionData.testType`/`actionData.submissionId`, NOT `actionUrl` -- Cloud Functions'
 * `sendNotification.js::notifyEvaluationComplete` has always written `actionData: { submissionId,
 * testType }` correctly; only its `actionUrl` field was the self-referential
 * `Routes.NOTIFICATIONS_CENTER` bug (server-side fix pending deploy as of this writing). Reading
 * `actionData` instead means this works against notification docs written before that server fix
 * ships too, and stays parity with web's `utils/notificationResultRoute.ts`, which reads the same
 * two `actionData` fields for the same reason.
 *
 * GTO's 5 not-yet-ported sub-tests (PGT/GOR/HGT/individual-obstacles/CT -- `functions/src/
 * evaluation/gtoEvaluate.js`'s `GTO_SUBTYPE_CONFIG` writes no `gto_results` doc for them, and
 * `StudyContentGraph.kt`'s `TopicScreen.onNavigateToTest` routes them to the same honest
 * placeholder) have no branch here and fall through to `null`, same as an unrecognized/missing
 * `testType`.
 */
fun resolveNotificationResultDestination(notification: SSBMaxNotification): SSBMaxDestinations? {
    val submissionId = notification.actionData?.get("submissionId") ?: return null
    val testType = notification.actionData?.get("testType") ?: return null

    return when (testType) {
        "OIR" -> SSBMaxDestinations.OIRTestResult(submissionId)
        "PPDT" -> SSBMaxDestinations.PPDTSubmissionResult(submissionId)
        "TAT" -> SSBMaxDestinations.TATSubmissionResult(submissionId)
        "WAT" -> SSBMaxDestinations.WATSubmissionResult(submissionId)
        "SRT" -> SSBMaxDestinations.SRTSubmissionResult(submissionId)
        "SD" -> SSBMaxDestinations.SDSubmissionResult(submissionId)
        "PIQ" -> SSBMaxDestinations.PIQSubmissionResult(submissionId)
        "GTO_GD" -> SSBMaxDestinations.GTOGDResult(submissionId)
        "GTO_LECTURETTE" -> SSBMaxDestinations.GTOLecturetteResult(submissionId)
        "GTO_GPE" -> SSBMaxDestinations.GTOGPEResult(submissionId)
        "IO" -> SSBMaxDestinations.InterviewResult(submissionId)
        else -> null
    }
}
