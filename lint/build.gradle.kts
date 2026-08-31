plugins {
    id("java-library")
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

dependencies {
    // Lint API dependencies
    compileOnly("com.android.tools.lint:lint-api:32.0.0")
    compileOnly("com.android.tools.lint:lint-checks:32.0.0")

    // Kotlin standard library
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.4.10")

    // Testing dependencies
    testImplementation("junit:junit:4.13.2")
    testImplementation("com.android.tools.lint:lint:32.0.0")
    testImplementation("com.android.tools.lint:lint-tests:32.0.0")
    testImplementation("com.android.tools:testutils:31.5.1")
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
}

tasks.jar {
    manifest {
        attributes(
            "Lint-Registry-v2" to "com.ssbmax.lint.SSBMaxIssueRegistry"
        )
    }
}
