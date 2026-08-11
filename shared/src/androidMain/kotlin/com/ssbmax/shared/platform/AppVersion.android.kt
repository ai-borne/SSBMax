package com.ssbmax.shared.platform

import com.ssbmax.shared.BuildConfig

actual fun currentAppVersion(): String = BuildConfig.APP_VERSION_NAME
