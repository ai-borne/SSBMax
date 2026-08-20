package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.repository.OirResultRepository
import com.ssbmax.shared.data.repository.toDomain
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore

/**
 * GitLive-Firebase-backed implementation, with a SQLDelight read-through/
 * write-through cache (Phase 2) in front of Firestore. Fetches one submission
 * document from the "submissions" collection (matches the existing Android
 * SubmissionRepository's collection — confirmed via FirestoreSubmissionRepository
 * lookup) and maps it into the domain model. Mirrors
 * OIRSubmissionResultViewModel.parseOIRTestResult's defaulting behavior
 * (missing/malformed fields -> 0/empty, never throw) so behavior parity is
 * preserved for this slice.
 */
class GitLiveOirResultRepository(
    private val cache: OirResultCache
) : OirResultRepository {

    override suspend fun getOirResult(submissionId: String): Result<OIRTestResult?> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        val cached = cache.get(submissionId)
        if (cached != null) return Result.success(cached.toDomain())
        return fetchAndCacheFromFirestore(submissionId)
    }

    private suspend fun fetchAndCacheFromFirestore(submissionId: String): Result<OIRTestResult?> {
        return try {
            val snapshot = Firebase.firestore
                .collection(SsbContracts.FirestorePaths.SUBMISSIONS)
                .document(submissionId)
                .get()

            if (!snapshot.exists) {
                return Result.success(null)
            }

            val dto = snapshot.data(OirSubmissionDocumentDto.serializer())
            val resultDto = dto.data?.testResult
                ?: return Result.success(null)

            cache.put(submissionId, resultDto)
            Result.success(resultDto.toDomain())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
