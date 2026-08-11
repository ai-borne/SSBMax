package com.ssbmax.shared.platform

import platform.Foundation.NSBundle

actual fun currentAppVersion(): String =
    NSBundle.mainBundle.objectForInfoDictionaryKey("CFBundleShortVersionString") as? String ?: "0.0.0"
