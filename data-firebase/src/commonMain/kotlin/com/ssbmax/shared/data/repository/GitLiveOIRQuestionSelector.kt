package com.ssbmax.shared.data.repository

import com.ssbmax.shared.db.CachedOIRQuestion as CachedOIRQuestionRow
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionDistribution
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.domain.validation.OIRQuestionValidator
import kotlin.time.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

private const val UNUSED_THRESHOLD_DAYS = 7L

/**
 * Selects questions from the local SQLDelight cache, maintaining the required
 * type distribution defined once in [OIRQuestionDistribution]. Split out of
 * [GitLiveOIRQuestionCacheManager] for the same reason as the Android
 * original: single responsibility + this repo's 300-line-per-file limit.
 *
 * `optionsJson` is (de)serialized via a local `@Serializable` DTO
 * ([OirOptionJsonDto]) rather than [OIROption] directly, since [OIROption] is
 * a widely-shared domain type left untouched by this port -- same reasoning
 * as [GitLiveOIRQuestionCacheManager]'s `toEntityMap()` adapter.
 */
class GitLiveOIRQuestionSelector(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries
    private val json = Json { ignoreUnknownKeys = true }

    /** Returns [count] valid questions, maintaining the required type distribution. */
    suspend fun selectQuestions(count: Int = 50): Result<List<OIRQuestion>> = try {
        val targets = OIRQuestionDistribution.counts(count)
        val unusedThreshold = Clock.System.now().toEpochMilliseconds() - (UNUSED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000L)

        val selected = selectByType(targets, unusedThreshold)
        topUpIfNeeded(selected, targets, count, unusedThreshold)
        val all = selected.values.flatten().shuffled()
        Result.success(all.map { toDomain(it) })
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun selectByType(
        targets: Map<OIRQuestionType, Int>,
        unusedThreshold: Long
    ): MutableMap<OIRQuestionType, List<CachedOIRQuestionRow>> = targets.mapValues { (type, target) ->
        fetchByType(type.name, unusedThreshold, target)
    }.toMutableMap()

    private fun topUpIfNeeded(
        selected: MutableMap<OIRQuestionType, List<CachedOIRQuestionRow>>,
        targets: Map<OIRQuestionType, Int>,
        count: Int,
        unusedThreshold: Long
    ) {
        val currentTotal = selected.values.sumOf { it.size }
        if (currentTotal >= count) return

        var remaining = count - currentTotal
        for ((type, target) in targets) {
            if (remaining <= 0) break
            if (selected.getValue(type).size < target) continue
            val extra = fetchByType(type.name, unusedThreshold, target + remaining)
            val gained = extra.size - selected.getValue(type).size
            if (gained > 0) {
                selected[type] = extra
                remaining -= gained
            }
        }
    }

    /**
     * Returns up to [count] structurally-valid questions of [type]. Over-fetches
     * (x3) and drops anything [OIRQuestionValidator] rejects, so duds already in
     * the pool are skipped at selection time.
     */
    private fun fetchByType(type: String, unusedThreshold: Long, count: Int): List<CachedOIRQuestionRow> {
        var questions = filterValid(
            queries.selectUnusedOIRQuestionsByType(type, unusedThreshold, (count * 3).toLong()).executeAsList()
        )
        if (questions.size < count) {
            questions = filterValid(queries.selectOIRQuestionsByType(type, (count * 3).toLong()).executeAsList())
        }
        return questions.take(count)
    }

    private fun filterValid(questions: List<CachedOIRQuestionRow>): List<CachedOIRQuestionRow> =
        questions.filter { OIRQuestionValidator.validate(toDomain(it)).isValid }

    /** Maps a loosely-typed Firestore question map (see `toEntityMap()`) to a cache row. */
    fun toEntity(questionMap: Map<String, Any?>, batchId: String, index: Int, cachedAt: Long): CachedOIRQuestionRow {
        @Suppress("UNCHECKED_CAST")
        val optionsList = questionMap["options"] as? List<Map<String, Any?>>
        val optionsJson = json.encodeToString(
            ListSerializer(OirOptionJsonDto.serializer()),
            optionsList.orEmpty().map { OirOptionJsonDto(it["id"] as? String, it["text"] as? String, it["imageUrl"] as? String) }
        )
        @Suppress("UNCHECKED_CAST")
        val correctAnswerIdsList = questionMap["correctAnswerIds"] as? List<String>
        @Suppress("UNCHECKED_CAST")
        val tagsList = questionMap["tags"] as? List<String>

        return CachedOIRQuestionRow(
            id = questionMap["id"] as? String ?: "oir_q_${cachedAt}_$index",
            questionNumber = ((questionMap["questionNumber"] as? Int) ?: (index + 1)).toLong(),
            type = questionMap["type"] as? String ?: "VERBAL_REASONING",
            subtype = questionMap["subtype"] as? String,
            questionText = questionMap["questionText"] as? String ?: "",
            optionsJson = optionsJson,
            correctAnswerId = questionMap["correctAnswerId"] as? String ?: "",
            explanation = questionMap["explanation"] as? String ?: "",
            questionImageUrl = questionMap["questionImageUrl"] as? String,
            // The SQLDelight column is retained for legacy cache compatibility, but is not
            // part of OIR selection. Empty is the explicit representation of missing metadata.
            difficulty = questionMap["difficulty"] as? String ?: "",
            tags = tagsList?.joinToString(",") ?: "",
            batchId = batchId,
            cachedAt = cachedAt,
            lastUsed = null,
            usageCount = 0L,
            correctAnswerIds = correctAnswerIdsList?.let { json.encodeToString(ListSerializer(String.serializer()), it) }
        )
    }

    internal fun toDomain(entity: CachedOIRQuestionRow): OIRQuestion {
        val options = runCatching { json.decodeFromString(ListSerializer(OirOptionJsonDto.serializer()), entity.optionsJson) }
            .getOrDefault(emptyList())
            .map { OIROption(id = it.id ?: "", text = it.text ?: "", imageUrl = it.imageUrl) }
        return OIRQuestion(
            id = entity.id,
            questionNumber = entity.questionNumber.toInt(),
            type = OIRQuestionType.valueOf(entity.type),
            questionText = entity.questionText,
            options = options,
            correctAnswerId = entity.correctAnswerId,
            correctAnswerIds = entity.correctAnswerIds
                ?.let { runCatching { json.decodeFromString(ListSerializer(String.serializer()), it) }.getOrDefault(emptyList()) }
                ?: emptyList(),
            explanation = entity.explanation,
            difficulty = entity.difficulty
                .takeIf { it.isNotBlank() }
                ?.let { runCatching { QuestionDifficulty.valueOf(it) }.getOrNull() }
                ?: QuestionDifficulty.MEDIUM,
            timeSeconds = 60,
            questionImageUrl = entity.questionImageUrl?.let { normalizeStorageUrl(it) }
        )
    }

    private fun normalizeStorageUrl(raw: String): String =
        if (raw.startsWith("gs://")) raw.replaceFirst("gs://", "https://storage.googleapis.com/") else raw
}

@Serializable
internal data class OirOptionJsonDto(
    val id: String? = null,
    val text: String? = null,
    val imageUrl: String? = null
)
