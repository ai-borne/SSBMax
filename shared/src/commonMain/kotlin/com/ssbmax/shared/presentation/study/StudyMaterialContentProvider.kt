package com.ssbmax.shared.presentation.study

import org.jetbrains.compose.resources.ExperimentalResourceApi
import ssbmax.shared.generated.resources.Res

/**
 * KMP port of the Android `app/.../ui/study/StudyMaterialContentProvider.kt`
 * -- a MINIMAL fallback for edge cases only (all real study materials load
 * from Firestore via [com.ssbmax.shared.presentation.study.StudyMaterialDetailViewModel]).
 *
 * Only purpose (unchanged from the Android original): load the PIQ HTML
 * form (not stored in Firestore) and provide a generic "content unavailable"
 * message for edge cases. `context.assets.open(fileName)` (Android-only)
 * replaced with `Res.readBytes("files/$fileName")` -- Compose Multiplatform's
 * own resource-reading API, already established by this module's
 * `platform/audio/WhiteNoisePlayer` for `pink_noise.wav`; the same
 * `files/` resource directory now also holds `piq_form.html`.
 */
object StudyMaterialContentProvider {

    fun getMaterial(materialId: String): StudyMaterialContent {
        return when (materialId) {
            "piq_form_reference" -> getPIQFormPlaceholder()
            else -> getContentUnavailable(materialId)
        }
    }

    private fun getPIQFormPlaceholder(): StudyMaterialContent {
        return StudyMaterialContent(
            id = "piq_form_reference",
            title = "SSB PIQ Form (Reference)",
            category = "PIQ Form",
            author = "SSB",
            publishedDate = "2025",
            readTime = "5 min read",
            content = "<!DOCTYPE html>", // Marker to indicate HTML content
            isPremium = false,
            tags = listOf("PIQ", "Form", "Reference"),
            relatedMaterials = emptyList<RelatedMaterial>()
        )
    }

    /**
     * Load the PIQ form HTML from Compose Multiplatform resources
     * (`shared/commonMain/composeResources/files/piq_form.html`).
     */
    @OptIn(ExperimentalResourceApi::class)
    suspend fun loadPIQFormHtml(): String {
        return try {
            Res.readBytes("files/piq_form.html").decodeToString()
        } catch (e: Exception) {
            "<html><body><p>Error loading HTML content: ${e.message}</p></body></html>"
        }
    }

    private fun getContentUnavailable(id: String) = StudyMaterialContent(
        id = id,
        title = "Content Unavailable",
        category = "SSB Preparation",
        author = "SSB Expert",
        publishedDate = "2025",
        readTime = "N/A",
        content = """
# Content Currently Unavailable

This study material is stored in our cloud database. Please check:

- **Internet Connection**: Ensure you're connected to the internet
- **App Update**: Make sure you have the latest version of SSBMax
- **Try Again**: Pull down to refresh or close and reopen the material

Study materials require an internet connection to load -- they aren't stored on your device
for offline reading yet.

If the problem persists, please contact support@ssbmax.com.
        """.trimIndent(),
        isPremium = false,
        tags = listOf("Error"),
        relatedMaterials = emptyList<RelatedMaterial>()
    )
}
