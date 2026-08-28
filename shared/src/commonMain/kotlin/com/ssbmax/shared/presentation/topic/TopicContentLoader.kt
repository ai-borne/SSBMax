package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.domain.model.TestType

/**
 * KMP port of the Android app/.../ui/topic/TopicContentLoader.kt -- static
 * per-topic introduction text + test list (local fallback content). Each
 * topic's introduction prose lives in its own TopicIntro<Topic>.kt file
 * (one function each) to keep every generated file under the repo's
 * 300-line Quality Limit.
 *
 * GENERATED from the content/topics markdown files by scripts/content/generateKmpFallback.js
 * -- do not hand-edit; edit the markdown source and regenerate instead.
 */
object TopicContentLoader {

    fun getTopicInfo(testType: String): TopicInfo {
        return when (testType.uppercase()) {
            "OIR" -> TopicInfo("Officer Intelligence Rating", getIntroduction(testType), getStudyMaterials(testType), listOf(TestType.OIR))
            "PPDT" -> TopicInfo("Picture Perception & Description Test", getIntroduction(testType), getStudyMaterials(testType), listOf(TestType.PPDT))
            "PIQ_FORM", "PIQ" -> TopicInfo("Personal Information Questionnaire", getIntroduction("PIQ_FORM"), getStudyMaterials("PIQ_FORM"), listOf(TestType.PIQ))
            "PSYCHOLOGY" -> TopicInfo("Psychology Tests", getIntroduction(testType), getStudyMaterials(testType), listOf(TestType.TAT, TestType.WAT, TestType.SRT, TestType.SD))
            "GTO" -> TopicInfo(
                "Group Testing Officer Tasks", getIntroduction(testType), getStudyMaterials(testType),
                listOf(TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR, TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT)
            )
            "INTERVIEW" -> TopicInfo("Interview Preparation", getIntroduction(testType), getStudyMaterials(testType), listOf(TestType.IO))
            "CONFERENCE" -> TopicInfo("Conference", getIntroduction("CONFERENCE"), getStudyMaterials("CONFERENCE"), emptyList())
            "MEDICALS" -> TopicInfo("Medical Examination", getIntroduction("MEDICALS"), getStudyMaterials("MEDICALS"), emptyList())
            "SSB_OVERVIEW" -> TopicInfo("Overview of SSB", getIntroduction("SSB_OVERVIEW"), getStudyMaterials("SSB_OVERVIEW"), emptyList())
            else -> TopicInfo("SSB Topic", "Learn about SSB selection process.", emptyList(), emptyList())
        }
    }

    private fun getIntroduction(testType: String): String {
        return when (testType.uppercase()) {
            "OIR" -> oirIntroduction()
            "PPDT" -> ppdtIntroduction()
            "PIQ_FORM" -> piqFormIntroduction()
            "PSYCHOLOGY" -> psychologyIntroduction()
            "GTO" -> gtoIntroduction()
            "INTERVIEW" -> interviewIntroduction()
            "CONFERENCE" -> conferenceIntroduction()
            "MEDICALS" -> medicalsIntroduction()
            "SSB_OVERVIEW" -> ssbOverviewIntroduction()
            else -> "Detailed information about this topic will be available soon."
        }
    }

    private fun getStudyMaterials(testType: String): List<StudyMaterialItem> {
        return StudyMaterialsProvider.getStudyMaterials(testType)
    }
}

/**
 * Topic information model
 */
data class TopicInfo(
    val title: String,
    val introduction: String,
    val studyMaterials: List<StudyMaterialItem>,
    val tests: List<TestType>
)
