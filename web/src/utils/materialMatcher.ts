import { StudyMaterial } from '../types/testContent';

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
    let typeMatches = false;

    if (targetTypes.size === 0) {
      typeMatches = true;
    } else if (material.testTypeId && targetTypes.has(material.testTypeId)) {
      typeMatches = true;
    } else {
      // Fallback matching over category or tags if testTypeId was not explicitly parsed
      const categoryLower = (material.category || '').toLowerCase();
      const tagsLower = (material.tags || []).map((t) => t.toLowerCase());
      for (const targetType of targetTypes) {
        if (
          categoryLower.includes(targetType) ||
          tagsLower.some((t) => t.includes(targetType))
        ) {
          typeMatches = true;
          break;
        }
      }
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
