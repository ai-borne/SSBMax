package com.ssbmax.shared.domain.validation

import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore
import com.ssbmax.shared.domain.scoring.EntryType
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertNotNull
import kotlin.test.assertNotEquals
import kotlin.test.fail
import kotlin.test.Test
import kotlin.time.measureTime

/**
 * Performance tests for SSB Validation system.
 * 
 * Requirements:
 * - Single validation: <10ms
 * - Batch validation (100 candidates): <500ms
 * - Prompt generation: <50ms
 * 
 * These tests ensure the validation system is fast enough
 * for real-time use in workers without blocking.
 */
class SSBValidationPerformanceTest {

    // =========================================
    // SINGLE VALIDATION PERFORMANCE
    // =========================================

    @Test
    fun `single validation completes under 10ms`() {
        val scores = createValidScores()
        
        // Warm up JIT
        repeat(50) {
            SSBScoreValidator.validate(scores, EntryType.NDA)
        }
        
        // Measure actual performance
        val times = mutableListOf<Long>()
        repeat(100) {
            val nanos = measureTime {
                SSBScoreValidator.validate(scores, EntryType.NDA)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMs = times.average() / 1_000_000
        val maxMs = times.maxOrNull()!! / 1_000_000
        
        println("Single validation: avg=${avgMs}ms, max=${maxMs}ms")
        
        assertTrue(avgMs < 10.0, "Average validation time should be under 10ms, was ${avgMs}ms")
        assertTrue(maxMs < 50.0, "Max validation time should be under 50ms, was ${maxMs}ms")
    }

    @Test
    fun `ValidationIntegration validateScores completes under 10ms`() {
        val scores = createOLQScoreMap()
        
        // Warm up
        repeat(10) {
            ValidationIntegration.validateScores(scores, EntryType.NDA)
        }
        
        // Measure
        val times = mutableListOf<Long>()
        repeat(100) {
            val nanos = measureTime {
                ValidationIntegration.validateScores(scores, EntryType.NDA)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMs = times.average() / 1_000_000
        println("ValidationIntegration.validateScores: avg=${avgMs}ms")
        
        assertTrue(avgMs < 10.0, "ValidationIntegration should complete under 10ms, was ${avgMs}ms")
    }

    // =========================================
    // BATCH VALIDATION PERFORMANCE
    // =========================================

    @Test
    fun `batch validation of 100 candidates completes under 500ms`() {
        val candidates = (1..100).map { createRandomScores() }
        
        // Warm up
        candidates.take(10).forEach { 
            SSBScoreValidator.validate(it, EntryType.NDA) 
        }
        
        // Measure batch
        val nanos = measureTime {
            candidates.forEach { scores ->
                SSBScoreValidator.validate(scores, EntryType.NDA)
            }
        }.inWholeNanoseconds
        
        val totalMs = nanos / 1_000_000
        println("Batch validation (100 candidates): ${totalMs}ms")
        
        assertTrue(totalMs < 500, "Batch validation should complete under 500ms, was ${totalMs}ms")
    }

    // =========================================
    // INDIVIDUAL OPERATION PERFORMANCE
    // =========================================

    @Test
    fun `countLimitations is fast`() {
        val scores = createValidScores()
        
        val times = mutableListOf<Long>()
        repeat(1000) {
            val nanos = measureTime {
                SSBScoreValidator.countLimitations(scores)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMicros = times.average() / 1000
        println("countLimitations: avg=${avgMicros}μs")
        
        assertTrue(avgMicros < 1000, "countLimitations should be under 1ms")
    }

    @Test
    fun `checkFactorConsistency is fast`() {
        val scores = createValidScores()
        
        val times = mutableListOf<Long>()
        repeat(1000) {
            val nanos = measureTime {
                SSBScoreValidator.checkFactorConsistency(scores)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMicros = times.average() / 1000
        println("checkFactorConsistency: avg=${avgMicros}μs")
        
        assertTrue(avgMicros < 1000, "checkFactorConsistency should be under 1ms")
    }

    @Test
    fun `detectCriticalWeaknesses is fast`() {
        val scores = createValidScores()
        
        val times = mutableListOf<Long>()
        repeat(1000) {
            val nanos = measureTime {
                SSBScoreValidator.detectCriticalWeaknesses(scores)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMicros = times.average() / 1000
        println("detectCriticalWeaknesses: avg=${avgMicros}μs")
        
        assertTrue(avgMicros < 1000, "detectCriticalWeaknesses should be under 1ms")
    }

    @Test
    fun `calculateFactorAverages is fast`() {
        val scores = createValidScores()
        
        val times = mutableListOf<Long>()
        repeat(1000) {
            val nanos = measureTime {
                SSBScoreValidator.calculateFactorAverages(scores)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMicros = times.average() / 1000
        println("calculateFactorAverages: avg=${avgMicros}μs")
        
        assertTrue(avgMicros < 1000, "calculateFactorAverages should be under 1ms")
    }

    @Test
    fun `determineRecommendation is fast`() {
        val scores = createValidScores()
        
        val times = mutableListOf<Long>()
        repeat(1000) {
            val nanos = measureTime {
                SSBScoreValidator.determineRecommendation(scores, EntryType.NDA)
            }.inWholeNanoseconds
            times.add(nanos)
        }
        
        val avgMicros = times.average() / 1000
        println("determineRecommendation: avg=${avgMicros}μs")
        
        assertTrue(avgMicros < 2000, "determineRecommendation should be under 2ms")
    }

    // =========================================
    // HELPERS
    // =========================================

    private fun createValidScores(): Map<OLQ, Int> {
        return OLQ.entries.associateWith { 5 } // All good scores
    }

    private fun createOLQScoreMap(): Map<OLQ, OLQScore> {
        return OLQ.entries.associateWith { olq ->
            OLQScore(
                score = 5,
                confidence = 80,
                reasoning = "Test score for ${olq.displayName}"
            )
        }
    }

    private fun createRandomScores(): Map<OLQ, Int> {
        return OLQ.entries.associateWith { (1..10).random() }
    }
}
