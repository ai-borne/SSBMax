package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore

/**
 * GitLive-Firebase-backed port of the Android `SubmissionArchiveRepository`.
 *
 * Reads each stale submission document as a raw `Map<String, Any>` via [FirestoreRawMapSerializer]
 * (see that file's class doc for why this is possible on GitLive Firestore 2.1.0's public API),
 * writes it verbatim into `archived_submissions`, then deletes the original — same
 * copy-then-delete shape as the Android original, minus the per-item `Log.d`/`Log.e` calls (no
 * other ported `GitLive*SubmissionRepository` in this cluster logs either; errors surface through
 * the returned [Result] instead).
 */
class GitLiveSubmissionArchiveRepository {

    private val archivedCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.ARCHIVED_SUBMISSIONS)

    suspend fun archiveOldSubmissions(beforeTimestamp: Long): Result<Int> = try {
        val snapshot = Firebase.firestore.collectionGroup(SsbContracts.FirestorePaths.SUBMISSIONS_ARCHIVE_GROUP)
            .where { FIELD_SUBMITTED_AT lessThan beforeTimestamp }
            .get()

        var archivedCount = 0
        snapshot.documents.forEach { doc ->
            runCatching {
                val raw = doc.data(FirestoreRawMapSerializer)
                val submissionId = raw[FIELD_ID] as? String ?: doc.id
                archivedCollection.document(submissionId).set(FirestoreRawMapSerializer, raw)
                doc.reference.delete()
                archivedCount++
            }
        }
        Result.success(archivedCount)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to archive submissions: ${e.message}", e))
    }

    private companion object {
        const val FIELD_SUBMITTED_AT = "submittedAt"
        const val FIELD_ID = "id"
    }
}
