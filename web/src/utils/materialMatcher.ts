import { StudyMaterial } from '../types/testContent';
import { testTypeIdsForTopicType } from '../constants/topicTypeMapping';

export interface TestCardMatcherOptions {
  testTypeId?: StudyMaterial['testTypeId'];
  compositeTestTypeIds?: StudyMaterial['testTypeId'][];
  searchQuery?: string;
}

/**
 * Pure helper function to filter study materials for a test card based on exact testTypeId,
 * composite array matching (compositeTestTypeIds), and lowercased search query filtering over title and summary.
 */
export function filterMaterialsForTestCard(
  materials: StudyMaterial[],
  options: TestCardMatcherOptions
): StudyMaterial[] {
  const { testTypeId, compositeTestTypeIds, searchQuery } = options;

  const targetTypes = new Set<string>();
  if (testTypeId) {
    targetTypes.add(testTypeId);
  }
  if (compositeTestTypeIds && Array.isArray(compositeTestTypeIds)) {
    compositeTestTypeIds.forEach((id) => {
      if (id) targetTypes.add(id);
    });
  }

  const query = searchQuery ? searchQuery.trim().toLowerCase() : '';

  return materials.filter((material) => {
    // 1. Type matching logic
    let typeMatches: boolean;

    if (targetTypes.size === 0) {
      typeMatches = true;
    } else if (material.testTypeId && targetTypes.has(material.testTypeId)) {
      typeMatches = true;
    } else {
      // Explicit fallback (Phase 7, MEDIUM 4c): a coarse topicType (GTO, PSYCHOLOGY) that
      // covers several testTypeIds and so has no single material.testTypeId still matches
      // any card whose testTypeId it legitimately covers, per the exhaustive static table in
      // constants/topicTypeMapping.ts -- no fuzzy category/tag substring guessing.
      const topicTestTypeIds = testTypeIdsForTopicType(material.topicType);
      typeMatches = topicTestTypeIds.some((id) => targetTypes.has(id));
    }

    if (!typeMatches) {
      return false;
    }

    // 2. Search query matching logic
    if (!query) {
      return true;
    }

    const titleLower = (material.title || '').toLowerCase();
    const summaryLower = (material.summary || '').toLowerCase();
    const categoryLower = (material.category || '').toLowerCase();

    return (
      titleLower.includes(query) ||
      summaryLower.includes(query) ||
      categoryLower.includes(query)
    );
  });
}
