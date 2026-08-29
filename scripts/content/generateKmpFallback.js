#!/usr/bin/env node
/**
 * Regenerates the Kotlin files that hold KMP's offline fallback prose
 * for topic introductions from content/topics/*.md, so the fallback stops
 * drifting from the git-authored source of truth (HIGH 4b,
 * docs/plans/i-just-watched-a-nested-russell.md — the fallback must be
 * PRESERVED, never deleted: there is no Firestore offline persistence on
 * KMP, so this is the only offline guarantee).
 *
 * Each topic's introduction is written to its own TopicIntro<Key>.kt file
 * (one `internal fun xIntroduction(): String`) to keep every generated file
 * under the repo's 300-line Quality Limit -- Phase 7 expanded every topic's
 * prose to genuine guide depth, so the old "only CONFERENCE needs its own
 * file" split no longer holds; this generalizes that same pattern to all
 * topics instead of special-casing one. Run after
 * `npm run content:publish:write` whenever content/topics/*.md changes.
 */

const fs = require('fs');
const path = require('path');
const { parseContentFile } = require('./parseContentFile');
const { parseDocument } = require('./parseDocument');
const { documentModelToKotlin } = require('./kotlinCodegen');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const TOPICS_DIR = path.join(CONTENT_DIR, 'topics');
const SLUGS_LOCK_PATH = path.join(CONTENT_DIR, 'slugs.lock.json');
const TOPIC_DIR = path.join(ROOT, 'shared/src/commonMain/kotlin/com/ssbmax/shared/presentation/topic');
const LOADER_PATH = path.join(TOPIC_DIR, 'TopicContentLoader.kt');

// testType key -> { label used in getTopicInfo's `when`, TestType list literal, fn: intro function name }
const TOPIC_DISPATCH = {
  OIR: { label: '"Officer Intelligence Rating"', tests: 'listOf(TestType.OIR)', fn: 'oirIntroduction' },
  PPDT: { label: '"Picture Perception & Description Test"', tests: 'listOf(TestType.PPDT)', fn: 'ppdtIntroduction' },
  PIQ_FORM: { label: '"Personal Information Questionnaire"', tests: 'listOf(TestType.PIQ)', fn: 'piqFormIntroduction' },
  PSYCHOLOGY: {
    label: '"Psychology Tests"',
    tests: 'listOf(TestType.TAT, TestType.WAT, TestType.SRT, TestType.SD)',
    fn: 'psychologyIntroduction',
  },
  GTO: {
    label: '"Group Testing Officer Tasks"',
    tests: 'listOf(TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR, TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT)',
    fn: 'gtoIntroduction',
  },
  INTERVIEW: { label: '"Interview Preparation"', tests: 'listOf(TestType.IO)', fn: 'interviewIntroduction' },
  CONFERENCE: { label: '"Conference"', tests: 'emptyList()', fn: 'conferenceIntroduction' },
  MEDICALS: { label: '"Medical Examination"', tests: 'emptyList()', fn: 'medicalsIntroduction' },
  SSB_OVERVIEW: { label: '"Overview of SSB"', tests: 'emptyList()', fn: 'ssbOverviewIntroduction' },
};

// getTopicInfo() dispatches "PIQ_FORM"/"PIQ" together, and GTO's TestType
// list is long enough to need its own line — keep the hand-authored
// dispatch shape rather than generating a lossy generic one.
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

/** File name for one topic's split-out introduction file, e.g. TopicIntroPiqForm.kt. */
function introFileName(key) {
  const pascal = key
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
  return `TopicIntro${pascal}.kt`;
}

/** File name for one topic's generated structured DocumentModel, e.g. TopicIntroOirStructured.kt. */
function structuredFileName(key) {
  return introFileName(key).replace(/\.kt$/, 'Structured.kt');
}

/** Structured-fallback function name for one topic, e.g. oirIntroductionSections. */
function structuredFnName(key) {
  return `${TOPIC_DISPATCH[key].fn}Sections`;
}

/**
 * `check`: verify-only mode (mirrors `generate-contracts.js --check` / `buildSlugLock.js
 * --check`) -- computes every generated file's content but never writes; returns the list of
 * paths that differ from what's committed instead. Used by generateKmpFallback.drift.test.js so
 * a `content/topics/*.md` edit that nobody regenerated the fallback for fails CI loudly rather
 * than shipping a KMP offline fallback that has silently drifted from git (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md).
 */
function generate({ check = false } = {}) {
  const topics = loadTopics();
  const slugsLock = JSON.parse(fs.readFileSync(SLUGS_LOCK_PATH, 'utf8'));
  for (const key of Object.keys(TOPIC_DISPATCH)) {
    if (!topics[key]) throw new Error(`content/topics/${key}.md missing or empty — cannot regenerate fallback`);
  }

  const drifted = [];
  const writeFile = (filePath, content) => {
    if (!check) {
      fs.writeFileSync(filePath, content);
      return;
    }
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (current !== content) drifted.push(path.relative(ROOT, filePath));
  };

  const introCases = Object.keys(TOPIC_DISPATCH)
    .map((k) => `            "${k}" -> ${TOPIC_DISPATCH[k].fn}()`)
    .join('\n');

  const structuredCases = Object.keys(TOPIC_DISPATCH)
    .map((k) => `            "${k}" -> ${structuredFnName(k)}()`)
    .join('\n');

  const loaderKt = `package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.content.blocks.DocumentModel

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
${DISPATCH_LINES.join('\n')}
        }
    }

    private fun getIntroduction(testType: String): String {
        return when (testType.uppercase()) {
${introCases}
            else -> "Detailed information about this topic will be available soon."
        }
    }

    /**
     * Structured twin of [getIntroduction] (Phase 5, docs/plans/write-the-phased-plan-wobbly-pancake.md)
     * -- the offline-fallback [DocumentModel] every topic now has, generated from the exact same
     * content/topics markdown source. \`null\` for a testType with no [TopicInfo] entry above (the
     * pre-existing "SSB Topic" catch-all), matching [com.ssbmax.shared.presentation.topic.TopicViewModel]'s
     * "no structured model for this topic" contract.
     */
    fun getStructuredIntroduction(testType: String): DocumentModel? {
        return when (testType.uppercase()) {
${structuredCases}
            else -> null
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

  writeFile(LOADER_PATH, loaderKt);

  const writtenIntroFiles = [];
  for (const key of Object.keys(TOPIC_DISPATCH)) {
    const { fn } = TOPIC_DISPATCH[key];
    const fileName = introFileName(key);
    const filePath = path.join(TOPIC_DIR, fileName);
    const kt = `package com.ssbmax.shared.presentation.topic

/**
 * The ${key} topic's introduction text, split out of [TopicContentLoader]
 * purely to keep every generated file under the repo's 300-line Quality
 * Limit -- no behavior change from having it inline.
 *
 * GENERATED from content/topics/${key}.md by
 * scripts/content/generateKmpFallback.js -- do not hand-edit.
 */
internal fun ${fn}(): String = ${kotlinTripleQuoted(topics[key], 4)}
`;
    writeFile(filePath, kt);
    writtenIntroFiles.push(fileName);

    const structuredModel = parseDocument(topics[key], {
      sourcePath: `topics/${key}.md`,
      existingSlugs: slugsLock,
    });
    const structuredFn = structuredFnName(key);
    const structuredFileNm = structuredFileName(key);
    const structuredKt = `package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.ui.content.blocks.CalloutBlock
import com.ssbmax.shared.ui.content.blocks.ComparisonBlock
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import com.ssbmax.shared.ui.content.blocks.LabelValue
import com.ssbmax.shared.ui.content.blocks.ListBlock
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock
import com.ssbmax.shared.ui.content.blocks.SpecTableBlock
import com.ssbmax.shared.ui.content.blocks.SubheadingBlock
import com.ssbmax.shared.ui.content.blocks.TableBlock
import com.ssbmax.shared.ui.content.blocks.TimelineBlock

/**
 * The ${key} topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [${TOPIC_DISPATCH[key].fn}]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/${key}.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun ${structuredFn}(): DocumentModel = ${documentModelToKotlin(structuredModel)}
`;
    writeFile(path.join(TOPIC_DIR, structuredFileNm), structuredKt);
    writtenIntroFiles.push(structuredFileNm);
  }

  if (check) return drifted;

  // Remove the old pre-Phase-7 CONFERENCE-only split file if it's still on disk
  // under its previous name, now superseded by TopicIntroConference.kt above.
  const legacyConferencePath = path.join(TOPIC_DIR, 'TopicContentLoaderConference.kt');
  if (fs.existsSync(legacyConferencePath)) {
    fs.unlinkSync(legacyConferencePath);
  }

  console.log(
    `Regenerated ${path.relative(ROOT, LOADER_PATH)} and ${writtenIntroFiles.length} topic intro file(s) from content/topics/*.md`
  );
  return [];
}

if (require.main === module) {
  try {
    const check = process.argv.includes('--check');
    const drifted = generate({ check });
    if (check) {
      if (drifted.length) {
        console.error(
          `KMP offline fallback is out of date (${drifted.length} file(s) differ). Run ` +
          `\`node scripts/content/generateKmpFallback.js\` and commit the result:\n` +
          drifted.map((f) => `  - ${f}`).join('\n')
        );
        process.exit(1);
      }
      console.log('KMP offline fallback is up to date.');
    }
  } catch (e) {
    console.error('generateKmpFallback failed:', e.message);
    process.exit(1);
  }
}

module.exports = { generate };
