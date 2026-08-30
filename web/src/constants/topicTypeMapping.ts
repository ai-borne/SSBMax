import { StudyMaterial } from '../types/testContent';

/**
 * Explicit topicType (Firestore study_materials' coarse field, e.g. "GTO", "PSYCHOLOGY") ->
 * testTypeId(s) mapping (Phase 7, MEDIUM 4c). Replaces ContentRepository's old
 * `parseTestTypeId` fuzzy keyword matcher, which guessed at a testTypeId by substring-
 * matching arbitrary category/tag text -- concretely mapping `'medicals' -> 'conference'`
 * and collapsing every PSYCHOLOGY material (TAT/WAT/SRT/SD) onto 'tat' alone.
 *
 * topicType is coarser than testTypeId: GTO and PSYCHOLOGY each cover several testTypeIds.
 * Most content/study-materials/gto_*.md files now carry their own `testTypeId` frontmatter
 * field (GTO taxonomy parity fix) so `filterMaterialsForTestCard` matches on that directly;
 * this table remains the fallback for materials that are genuinely shared across several
 * sub-tests (e.g. the GTO overview) and carry no single testTypeId of their own -- a
 * multi-valued topic maps to every testTypeId it can legitimately be, and such a material is
 * considered a match for a StudyTestCard's testTypeId if that id appears anywhere in its
 * topicType's list -- explicit and exhaustive, not fuzzy.
 *
 * MEDICALS and SSB_OVERVIEW are intentionally absent: no testTypeId exists for either, and
 * forcing one (as the old matcher did for MEDICALS -> 'conference') would be a wrong answer,
 * not just an incomplete one.
 */
export const TOPIC_TYPE_TO_TEST_TYPE_IDS: Record<string, NonNullable<StudyMaterial['testTypeId']>[]> = {
  OIR: ['oir'],
  PPDT: ['ppdt'],
  PIQ_FORM: ['piq'],
  PSYCHOLOGY: ['tat', 'wat', 'srt', 'sd'],
  GTO: ['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'lecturette', 'fgt'],
  INTERVIEW: ['interview'],
  CONFERENCE: ['conference'],
};

/** The single unambiguous testTypeId for a topicType, or undefined when the topic covers more than one (or none). */
export function primaryTestTypeIdForTopicType(topicType: string | undefined): StudyMaterial['testTypeId'] {
  if (!topicType) return undefined;
  const ids = TOPIC_TYPE_TO_TEST_TYPE_IDS[topicType.toUpperCase()];
  return ids && ids.length === 1 ? ids[0] : undefined;
}

/** Every testTypeId a given topicType can represent (empty array if topicType is unmapped). */
export function testTypeIdsForTopicType(topicType: string | undefined): NonNullable<StudyMaterial['testTypeId']>[] {
  if (!topicType) return [];
  return TOPIC_TYPE_TO_TEST_TYPE_IDS[topicType.toUpperCase()] ?? [];
}
