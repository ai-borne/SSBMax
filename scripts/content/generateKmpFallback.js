#!/usr/bin/env node
/**
 * Regenerates the two Kotlin files that hold KMP's offline fallback prose
 * for topic introductions from content/topics/*.md, so the fallback stops
 * drifting from the git-authored source of truth (HIGH 4b,
 * docs/plans/i-just-watched-a-nested-russell.md — the fallback must be
 * PRESERVED, never deleted: there is no Firestore offline persistence on
 * KMP, so this is the only offline guarantee).
 *
 * CONFERENCE is split into its own file purely to keep both under the
 * repo's 300-line Quality Limit (unchanged rationale from the files this
 * replaces). Run after `npm run content:publish:write` whenever
 * content/topics/*.md changes.
 */

const fs = require('fs');
const path = require('path');
const { parseContentFile } = require('./parseContentFile');

const ROOT = path.resolve(__dirname, '..', '..');
const TOPICS_DIR = path.join(ROOT, 'content', 'topics');
const TOPIC_DIR = path.join(ROOT, 'shared/src/commonMain/kotlin/com/ssbmax/shared/presentation/topic');
const LOADER_PATH = path.join(TOPIC_DIR, 'TopicContentLoader.kt');
const CONFERENCE_PATH = path.join(TOPIC_DIR, 'TopicContentLoaderConference.kt');

// testType key -> { label used in getTopicInfo's `when`, TestType list literal }
const TOPIC_DISPATCH = {
  OIR: { label: '"Officer Intelligence Rating"', tests: 'listOf(TestType.OIR)' },
  PPDT: { label: '"Picture Perception & Description Test"', tests: 'listOf(TestType.PPDT)' },
  PIQ_FORM: { label: '"Personal Information Questionnaire"', tests: 'listOf(TestType.PIQ)' },
  PSYCHOLOGY: { label: '"Psychology Tests"', tests: 'listOf(TestType.TAT, TestType.WAT, TestType.SRT, TestType.SD)' },
  GTO: {
    label: '"Group Testing Officer Tasks"',
    tests: 'listOf(TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR, TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT)',
  },
  INTERVIEW: { label: '"Interview Preparation"', tests: 'listOf(TestType.IO)' },
  CONFERENCE: { label: '"Conference"', tests: 'emptyList()' },
  MEDICALS: { label: '"Medical Examination"', tests: 'emptyList()' },
  SSB_OVERVIEW: { label: '"Overview of SSB"', tests: 'emptyList()' },
};

// getTopicInfo() dispatches "PIQ_FORM"/"PIQ" and "PIQ_FORM" together, and
// GTO's TestType list is long enough to need its own line — keep the
// hand-authored dispatch shape rather than generating a lossy generic one.
const DISPATCH_LINES = [
  `            "OIR" -> TopicInfo(${TOPIC_DISPATCH.OIR.label}, getIntroduction(testType), getStudyMaterials(testType), ${TOPIC_DISPATCH.OIR.tests})`,
  `            "PPDT" -> TopicInfo(${TOPIC_DISPATCH.PPDT.label}, getIntroduction(testType), getStudyMaterials(testType), ${TOPIC_DISPATCH.PPDT.tests})`,
  `            "PIQ_FORM", "PIQ" -> TopicInfo(${TOPIC_DISPATCH.PIQ_FORM.label}, getIntroduction("PIQ_FORM"), getStudyMaterials("PIQ_FORM"), ${TOPIC_DISPATCH.PIQ_FORM.tests})`,
  `            "PSYCHOLOGY" -> TopicInfo(${TOPIC_DISPATCH.PSYCHOLOGY.label}, getIntroduction(testType), getStudyMaterials(testType), ${TOPIC_DISPATCH.PSYCHOLOGY.tests})`,
  `            "GTO" -> TopicInfo(\n                ${TOPIC_DISPATCH.GTO.label}, getIntroduction(testType), getStudyMaterials(testType),\n                ${TOPIC_DISPATCH.GTO.tests}\n            )`,
  `            "INTERVIEW" -> TopicInfo(${TOPIC_DISPATCH.INTERVIEW.label}, getIntroduction(testType), getStudyMaterials(testType), ${TOPIC_DISPATCH.INTERVIEW.tests})`,
  `            "CONFERENCE" -> TopicInfo(${TOPIC_DISPATCH.CONFERENCE.label}, getIntroduction("CONFERENCE"), getStudyMaterials("CONFERENCE"), ${TOPIC_DISPATCH.CONFERENCE.tests})`,
  `            "MEDICALS" -> TopicInfo(${TOPIC_DISPATCH.MEDICALS.label}, getIntroduction("MEDICALS"), getStudyMaterials("MEDICALS"), ${TOPIC_DISPATCH.MEDICALS.tests})`,
  `            "SSB_OVERVIEW" -> TopicInfo(${TOPIC_DISPATCH.SSB_OVERVIEW.label}, getIntroduction("SSB_OVERVIEW"), getStudyMaterials("SSB_OVERVIEW"), ${TOPIC_DISPATCH.SSB_OVERVIEW.tests})`,
  `            else -> TopicInfo("SSB Topic", "Learn about SSB selection process.", emptyList(), emptyList())`,
];

function kotlinTripleQuoted(body, indent) {
  const pad = ' '.repeat(indent);
  const lines = body.split('\n').map((l) => l.trimEnd()).map((l) => (l ? pad + l : ''));
  return `"""\n${lines.join('\n')}\n${pad}""".trimIndent()`;
}

function loadTopics() {
  const topics = {};
  for (const file of fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.md'))) {
    const id = path.basename(file, '.md');
    const { body } = parseContentFile(fs.readFileSync(path.join(TOPICS_DIR, file), 'utf8'), file);
    topics[id] = body;
  }
  return topics;
}

function generate() {
  const topics = loadTopics();
  for (const key of Object.keys(TOPIC_DISPATCH)) {
    if (!topics[key]) throw new Error(`content/topics/${key}.md missing or empty — cannot regenerate fallback`);
  }

  const introCases = Object.keys(TOPIC_DISPATCH)
    .filter((k) => k !== 'CONFERENCE')
    .map((k) => `            "${k}" -> ${kotlinTripleQuoted(topics[k], 16)}`)
    .join('\n');

  const loaderKt = `package com.ssbmax.shared.presentation.topic

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
${DISPATCH_LINES.join('\n')}
        }
    }

    private fun getIntroduction(testType: String): String {
        return when (testType.uppercase()) {
${introCases}
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
`;

  const conferenceKt = `package com.ssbmax.shared.presentation.topic

/**
 * The Conference topic's introduction text, split out of
 * [TopicContentLoader] purely to keep both files under the repo's 300-line
 * Quality Limit -- no behavior change from having it inline.
 *
 * GENERATED from content/topics/CONFERENCE.md by
 * scripts/content/generateKmpFallback.js -- do not hand-edit.
 */
internal fun conferenceIntroduction(): String = ${kotlinTripleQuoted(topics.CONFERENCE, 4)}
`;

  fs.writeFileSync(LOADER_PATH, loaderKt);
  fs.writeFileSync(CONFERENCE_PATH, conferenceKt);
  console.log(`Regenerated ${path.relative(ROOT, LOADER_PATH)} and ${path.relative(ROOT, CONFERENCE_PATH)} from content/topics/*.md`);
}

if (require.main === module) {
  try {
    generate();
  } catch (e) {
    console.error('generateKmpFallback failed:', e.message);
    process.exit(1);
  }
}

module.exports = { generate };
