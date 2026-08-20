package com.ssbmax.shared.platform

/**
 * This binary's own version string ("1.2.3"), read from the platform build
 * artifact -- Android's `BuildConfig`, iOS's `Info.plist` -- rather than
 * threaded through Koin, so every call site (including ones that run before
 * any composition root argument is available) reads the real installed
 * version. Same `expect`/`actual` rationale as [isDebugBuild].
 */
expect fun currentAppVersion(): String
