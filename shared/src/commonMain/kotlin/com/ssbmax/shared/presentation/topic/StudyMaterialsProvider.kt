package com.ssbmax.shared.presentation.topic

/**
 * KMP port of the Android `app/.../ui/topic/StudyMaterialsProvider.kt` --
 * static per-topic study-material list (local fallback content, unchanged).
 */
object StudyMaterialsProvider {

    fun getStudyMaterials(testType: String): List<StudyMaterialItem> {
        return when (testType.uppercase()) {
            "OIR" -> oirMaterials()
            "PPDT" -> ppdtMaterials()
            "PIQ_FORM" -> piqFormMaterials()
            "PSYCHOLOGY" -> psychologyMaterials()
            "GTO" -> gtoMaterials()
            "INTERVIEW" -> interviewMaterials()
            "CONFERENCE" -> conferenceMaterials()
            "MEDICALS" -> medicalsMaterials()
            "SSB_OVERVIEW" -> ssbOverviewMaterials()
            else -> emptyList()
        }
    }

    private fun item(id: String, title: String, duration: String) =
        StudyMaterialItem(id = id, title = title, duration = duration, isPremium = false)

    private fun oirMaterials() = listOf(
        item("oir_1", "Understanding OIR Test Pattern", "8 min read"),
        item("oir_2", "Verbal Reasoning Mastery", "12 min read"),
        item("oir_3", "Non-Verbal Reasoning Strategies", "15 min read"),
        item("oir_4", "Time Management in OIR", "6 min read"),
        item("oir_5", "Common Mistakes to Avoid", "10 min read"),
        item("oir_6", "Practice Sets with Solutions", "30 min read"),
        item("oir_7", "Mental Math Shortcuts", "10 min read")
    )

    private fun ppdtMaterials() = listOf(
        item("ppdt_1", "PPDT Test Overview", "7 min read"),
        item("ppdt_2", "Story Writing Techniques", "15 min read"),
        item("ppdt_3", "Group Discussion Strategies", "12 min read"),
        item("ppdt_4", "Character Perception Skills", "10 min read"),
        item("ppdt_5", "Sample PPDT Stories", "20 min read"),
        item("ppdt_6", "Common PPDT Mistakes", "8 min read")
    )

    private fun psychologyMaterials() = listOf(
        item("psy_1", "Psychology Tests Overview", "10 min read"),
        item("psy_2", "TAT Mastery Guide", "18 min read"),
        item("psy_3", "WAT Response Strategies", "12 min read"),
        item("psy_4", "SRT Situation Analysis", "15 min read"),
        item("psy_5", "Self Description Writing", "14 min read"),
        item("psy_6", "Officer Like Qualities Explained", "20 min read"),
        item("psy_7", "Psychology Test Practice Sets", "45 min read"),
        item("psy_8", "Psychological Mindset Development", "16 min read")
    )

    private fun gtoMaterials() = listOf(
        item("gto_1", "GTO Tasks Overview", "12 min read"),
        item("gto_2", "Group Discussion Mastery", "15 min read"),
        item("gto_3", "Progressive Group Task Tips", "18 min read"),
        item("gto_4", "Half Group Task Techniques", "14 min read"),
        item("gto_5", "Lecturette Preparation", "10 min read"),
        item("gto_6", "Command Task Leadership", "12 min read"),
        item("gto_7", "Snake Race & FGT Strategies", "16 min read"),
        item("gto_8", "Group Planning Exercise Guide", "16 min read"),
        item("gto_9", "Final Group Task Strategy", "14 min read")
    )

    private fun interviewMaterials() = listOf(
        item("int_1", "SSB Interview Process", "10 min read"),
        item("int_2", "Personal Interview Preparation", "20 min read"),
        item("int_3", "Current Affairs Mastery", "25 min read"),
        item("int_4", "Military Knowledge Basics", "30 min read"),
        item("int_5", "Interview Body Language", "8 min read"),
        item("int_6", "Common Interview Questions", "18 min read"),
        item("int_7", "Mock Interview Scenarios", "40 min read")
    )

    private fun conferenceMaterials() = listOf(
        item("conf_1", "Conference Process Explained", "8 min read"),
        item("conf_2", "Final Assessment Criteria", "12 min read"),
        item("conf_3", "Conference Etiquette", "6 min read"),
        item("conf_4", "Handling Results", "10 min read")
    )

    private fun medicalsMaterials() = listOf(
        item("med_1", "Medical Standards Overview", "10 min read"),
        item("med_2", "Vision Requirements", "8 min read"),
        item("med_3", "Physical Fitness Standards", "12 min read"),
        item("med_4", "Medical Examination Process", "15 min read"),
        item("med_5", "Common Medical Rejections", "10 min read")
    )

    private fun piqFormMaterials() = listOf(
        item("piq_form_reference", "SSB PIQ Form (Reference)", "5 min read"),
        item("piq_1", "PIQ Form Guide", "15 min read"),
        item("piq_2", "Self-Consistency Tips", "10 min read"),
        item("piq_3", "Common PIQ Mistakes", "8 min read")
    )

    private fun ssbOverviewMaterials() = listOf(
        item("ssb_1", "Complete SSB Process", "20 min read"),
        item("ssb_2", "Preparation Roadmap", "15 min read"),
        item("ssb_3", "Success Stories", "25 min read"),
        item("ssb_4", "Myths vs Reality", "10 min read")
    )
}
