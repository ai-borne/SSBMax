package com.ssbmax.shared.data.repository

import com.russhwolf.settings.Settings
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.repository.UsageInfo

/**
 * Shared fakes for [DebugOverrideSubscriptionRepositoryTest] and
 * [DebugOverrideTestUsageRecorderTest]. Hand-rolled rather than MockK: this module's
 * `androidUnitTest` has no prior MockK usage against a concrete class, and these interfaces are
 * small enough that a fake reads clearer than a mock's `every {}` setup for records-then-asserts.
 */
class FakeSubscriptionRepository : SubscriptionRepository {
    var tierResult: Result<SubscriptionTier> = Result.success(SubscriptionTier.FREE)
    var monthlyUsageResult: Result<Map<String, UsageInfo>> = Result.success(emptyMap())
    var startDateResult: Result<Long?> = Result.success(null)
    var ownershipResult: Result<SubscriptionOwnership> = Result.success(SubscriptionOwnership(source = null, expiryDate = null))

    override suspend fun getSubscriptionTier(userId: String): Result<SubscriptionTier> = tierResult

    override suspend fun getMonthlyUsage(userId: String, month: String): Result<Map<String, UsageInfo>> =
        monthlyUsageResult

    override suspend fun getSubscriptionStartDate(userId: String): Result<Long?> = startDateResult

    override suspend fun getSubscriptionOwnership(userId: String): Result<SubscriptionOwnership> = ownershipResult
}

class FakeTestUsageRecorder : TestUsageRecorder {
    data class Call(val testType: TestType, val userId: String, val submissionId: String?)

    val calls = mutableListOf<Call>()

    override suspend fun recordTestUsage(testType: TestType, userId: String, submissionId: String?) {
        calls.add(Call(testType, userId, submissionId))
    }
}

/** Trivial in-memory [Settings] -- no `multiplatform-settings-test` artifact on this module's classpath. */
class FakeInMemorySettings : Settings {
    private val map = mutableMapOf<String, Any?>()

    override val keys: Set<String> get() = map.keys
    override val size: Int get() = map.size
    override fun clear() { map.clear() }
    override fun remove(key: String) { map.remove(key) }
    override fun hasKey(key: String) = map.containsKey(key)

    override fun putInt(key: String, value: Int) { map[key] = value }
    override fun getInt(key: String, defaultValue: Int) = map[key] as? Int ?: defaultValue
    override fun getIntOrNull(key: String) = map[key] as? Int

    override fun putLong(key: String, value: Long) { map[key] = value }
    override fun getLong(key: String, defaultValue: Long) = map[key] as? Long ?: defaultValue
    override fun getLongOrNull(key: String) = map[key] as? Long

    override fun putString(key: String, value: String) { map[key] = value }
    override fun getString(key: String, defaultValue: String) = map[key] as? String ?: defaultValue
    override fun getStringOrNull(key: String) = map[key] as? String

    override fun putFloat(key: String, value: Float) { map[key] = value }
    override fun getFloat(key: String, defaultValue: Float) = map[key] as? Float ?: defaultValue
    override fun getFloatOrNull(key: String) = map[key] as? Float

    override fun putDouble(key: String, value: Double) { map[key] = value }
    override fun getDouble(key: String, defaultValue: Double) = map[key] as? Double ?: defaultValue
    override fun getDoubleOrNull(key: String) = map[key] as? Double

    override fun putBoolean(key: String, value: Boolean) { map[key] = value }
    override fun getBoolean(key: String, defaultValue: Boolean) = map[key] as? Boolean ?: defaultValue
    override fun getBooleanOrNull(key: String) = map[key] as? Boolean
}
