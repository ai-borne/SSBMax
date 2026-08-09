package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/**
 * GitLive-Firebase-backed port of the recording half of the Android `core:data`
 * `SubscriptionManager` (it implements the same [TestUsageRecorder] interface
 * that `SubmitOIRTestUseCase`/`SubmitPPDTTestUseCase` already depend on).
 *
 * Same Firestore path as the Android original and [GitLiveSubscriptionRepository]:
 * `users/{userId}/subscription/usage_{yyyy-MM}`.
 *
 * Usage is keyed by the durable submission ID. The read/check/increment is a
 * Firestore transaction, so concurrent retries cannot both charge the same ID.
 * The operation is deliberately kept behind this repository boundary so the use
 * case cannot accidentally charge before its submission is durable.
 */
class GitLiveTestUsageRecorder : TestUsageRecorder {

    override suspend fun recordTestUsage(testType: TestType, userId: String, submissionId: String?) {
        val month = currentYearMonth()
        val docRef = Firebase.firestore
            .collection(USERS_COLLECTION)
            .document(userId)
            .collection("subscription")
            .document("usage_$month")

        val fieldName = fieldNameFor(testType)
        Firebase.firestore.runTransaction {
            val snapshot = get(docRef)
            val existing = if (snapshot.exists) {
                snapshot.data(SubscriptionUsageDto.serializer())
            } else {
                null
            }
            if (submissionId != null && existing?.recordedSubmissionIds?.contains(submissionId) == true) {
                return@runTransaction
            }

            if (!snapshot.exists) {
                // userId/month/lastUpdated must be populated because the rules validate
                // these fields on the first write of every monthly usage document.
                set(
                    docRef,
                    SubscriptionUsageDto(
                        userId = userId,
                        month = month,
                        lastUpdated = Clock.System.now().toEpochMilliseconds(),
                        recordedSubmissionIds = submissionId?.let(::listOf).orEmpty()
                    ).withIncrementedField(fieldName)
                )
            } else {
                val increment = fieldName to FieldValue.increment(1)
                val updatedAt = "lastUpdated" to Clock.System.now().toEpochMilliseconds()
                if (submissionId == null) {
                    update(docRef, increment, updatedAt)
                } else {
                    update(
                        docRef,
                        increment,
                        updatedAt,
                        "recordedSubmissionIds" to FieldValue.arrayUnion(submissionId)
                    )
                }
            }
        }
    }

    private fun SubscriptionUsageDto.withIncrementedField(fieldName: String): SubscriptionUsageDto = when (fieldName) {
        "oirTestsUsed" -> copy(oirTestsUsed = 1)
        "tatTestsUsed" -> copy(tatTestsUsed = 1)
        "watTestsUsed" -> copy(watTestsUsed = 1)
        "srtTestsUsed" -> copy(srtTestsUsed = 1)
        "ppdtTestsUsed" -> copy(ppdtTestsUsed = 1)
        "piqTestsUsed" -> copy(piqTestsUsed = 1)
        "gtoTestsUsed" -> copy(gtoTestsUsed = 1)
        "interviewTestsUsed" -> copy(interviewTestsUsed = 1)
        "sdTestsUsed" -> copy(sdTestsUsed = 1)
        else -> this
    }

    private fun fieldNameFor(testType: TestType): String = when (testType) {
        TestType.OIR -> "oirTestsUsed"
        TestType.TAT -> "tatTestsUsed"
        TestType.WAT -> "watTestsUsed"
        TestType.SRT -> "srtTestsUsed"
        TestType.PPDT -> "ppdtTestsUsed"
        TestType.PIQ -> "piqTestsUsed"
        TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR,
        TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT -> "gtoTestsUsed"
        TestType.IO -> "interviewTestsUsed"
        TestType.SD -> "sdTestsUsed"
    }

    private fun currentYearMonth(): String {
        val now = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault())
        return "${now.year}-${(now.month.ordinal + 1).toString().padStart(2, '0')}"
    }

    private companion object {
        const val USERS_COLLECTION = "users"
    }
}
