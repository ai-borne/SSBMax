package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.domain.model.TestType

/**
 * KMP port of the Android app/.../ui/topic/TopicContentLoader.kt -- static
 * per-topic introduction text + test list (local fallback content). The
 * Conference topic's introduction (by far the largest single block of text)
 * is split into [conferenceIntroduction] to keep this file under the repo's
 * 300-line Quality Limit, same rationale the Android original itself states
 * for splitting StudyMaterialsProvider out of this file.
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
            "OIR" -> """
                The Officer Intelligence Rating (OIR) test evaluates your cognitive abilities,
                logical reasoning, and problem-solving skills. It consists of verbal and
                non-verbal reasoning questions designed to assess your mental alertness and
                decision-making capabilities under time pressure.

                The test typically includes:
                - Verbal reasoning questions
                - Numerical ability problems
                - Abstract reasoning puzzles
                - Spatial visualization tasks

                Duration: 30-40 minutes
                Questions: 40-50 questions
                Difficulty: Moderate to High
                """.trimIndent()
            "PPDT" -> """
                Picture Perception and Description Test (PPDT) assesses your perception,
                imagination, and ability to construct a meaningful story from an ambiguous picture.

                The test evaluates:
                - Power of perception
                - Ability to interpret situations
                - Narration skills
                - Group discussion capabilities

                Process:
                1. Picture shown for 30 seconds
                2. Write a story in 4 minutes
                3. Group discussion on stories
                4. Final narration
                """.trimIndent()
            "PIQ_FORM" -> """
                Personal Information Questionnaire (PIQ) is a comprehensive form that captures
                your personal details, educational background, family information, and interests.

                Key sections:
                - Personal details and contact information
                - Educational qualifications
                - Family background
                - Hobbies and interests
                - Sports and extra-curricular activities

                Tips:
                - Fill honestly and accurately
                - Be consistent with your responses
                - Prepare to explain any gaps
                - Know your PIQ thoroughly for interview
                """.trimIndent()
            "PSYCHOLOGY" -> """
                Psychology Tests assess your personality traits, mental makeup, and suitability
                for a career in the Armed Forces. These tests reveal your true self through
                projective techniques.

                Tests included:
                - TAT (Thematic Apperception Test)
                - WAT (Word Association Test)
                - SRT (Situation Reaction Test)
                - SD (Self Description)

                What they assess:
                - Officer Like Qualities (15 OLQs)
                - Personality traits
                - Response patterns under stress
                - Leadership potential
                """.trimIndent()
            "GTO" -> """
                Group Testing Officer (GTO) tasks evaluate your performance in group settings
                and assess practical implementation of leadership qualities.

                Tasks include:
                - Group Discussion
                - Group Planning Exercise
                - Progressive Group Task (PGT)
                - Half Group Task (HGT)
                - Command Task
                - Final Group Task (FGT)
                - Lecturette

                Duration: 2 days (Day 3-4)
                Focus: Teamwork, leadership, problem-solving
                """.trimIndent()
            "INTERVIEW" -> """
                Personal Interview is conducted by the Interviewing Officer (IO) to assess
                your personality, motivation, and suitability for commissioned service.

                Interview covers:
                - Personal background
                - Educational details
                - Current affairs and general knowledge
                - Motivation for joining Armed Forces
                - Career goals and aspirations

                Tips:
                - Be honest and confident
                - Know your PIQ thoroughly
                - Stay updated with current affairs
                - Express genuine interest
                - Maintain eye contact
                """.trimIndent()
            "MEDICALS" -> """
                Medical Examination ensures you meet the physical and medical standards
                required for commissioned service in the Armed Forces.

                Examinations include:
                - Physical fitness tests
                - Eye test (6/6 vision without glasses for some entries)
                - Blood and urine tests
                - X-ray and ECG
                - Dental examination
                - ENT examination

                Common grounds for rejection:
                - Vision problems
                - Hearing defects
                - Orthopedic issues
                - Chronic diseases

                Tip: Maintain good health throughout preparation
                """.trimIndent()
            "SSB_OVERVIEW" -> """
                The Services Selection Board (SSB) is a 5-day comprehensive assessment
                process to select suitable candidates for commissioned service in the
                Indian Armed Forces.

                5-Day breakdown:
                - Day 1: Screening (OIR & PPDT)
                - Day 2: Psychology Tests
                - Day 3-4: GTO Tasks
                - Day 5: Interview & Conference

                What SSB assesses:
                - 15 Officer Like Qualities (OLQs)
                - Leadership potential
                - Personality traits
                - Physical fitness
                - Mental alertness

                Success rate: Approximately 3-5% of screened candidates
                """.trimIndent()
            "CONFERENCE" -> conferenceIntroduction()
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
