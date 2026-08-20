package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.CollectionReference
import dev.gitlive.firebase.firestore.firestore

internal const val GTO_FIELD_USER_ID = "userId"
internal const val GTO_FIELD_TEST_TYPE = "testType"
internal const val GTO_FIELD_STATUS = "status"
internal const val GTO_FIELD_SUBMITTED_AT = "submittedAt"

/**
 * Shared Firestore collection handles for the GTO repository cluster. Extracted out of the former
 * single `GitLiveGTORepository` god-class (300-line-file limit) so the outer repository and its
 * [GitLiveGTOSubmissionDelegate]/[GitLiveGTOProgressDelegate]/[GitLiveGTOResultsDelegate] delegates
 * all share one Firestore connection ("submissions"/"gto_results"/"user_progress", same as the
 * Android original) instead of each opening their own. Pure structural split — no behavior change
 * from the original merged class.
 */
internal class GitLiveGTOCollections {
    val submissions: CollectionReference = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)
    val results: CollectionReference = Firebase.firestore.collection(SsbContracts.FirestorePaths.GTO_RESULTS)
    val progress: CollectionReference = Firebase.firestore.collection(SsbContracts.FirestorePaths.USER_PROGRESS)
}
