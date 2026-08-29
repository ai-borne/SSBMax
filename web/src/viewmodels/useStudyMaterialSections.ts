import { useEffect, useState } from 'react';
import { ContentRepository } from '../repositories/ContentRepository';
import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import type { DocumentModel } from '../components/content/blocks/types';
import { isStructuredRenderingEnabled } from '../constants/contentFeatureFlags';
import type { ContentBundleTopicId } from '../generated/contentBundle';

// Module-level singleton default, not `new ContentRepository()` inline in the function
// signature -- an inline default is re-created every call, which would change the effect's
// dependency and re-trigger the fetch on every render for a caller that doesn't inject one.
const defaultContentRepository = new ContentRepository();

/**
 * Fetches the D2 side document `study_material_sections/{materialId}` (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md) for StudyReaderModal -- the authenticated Study
 * tab's reader, the one surface D4 named explicitly ("StudyReaderModal reads published
 * sections like every other surface") that was still on `renderMarkdown` after Phase 4/5.
 * Reuses the same `isStructuredRenderingEnabled` rollout flag as the public
 * `StudyTopicPage`/`FaqPage` so a topic's structured-rendering decision isn't duplicated --
 * `topicType` isn't a valid `ContentBundleTopicId` for every material (e.g. a legacy doc with
 * no `topicType` at all), which is treated the same as "not enabled": render markdown.
 */
export function useStudyMaterialSections(
  materialId: string | undefined,
  topicType: string | undefined,
  repository: IContentRepository = defaultContentRepository
): DocumentModel | null {
  const [sections, setSections] = useState<DocumentModel | null>(null);

  useEffect(() => {
    let isMounted = true;
    setSections(null);

    if (!materialId || !topicType || !isStructuredRenderingEnabled(topicType as ContentBundleTopicId)) {
      return;
    }

    repository.getStudyMaterialSections(materialId).then((result) => {
      if (isMounted) setSections(result);
    });

    return () => {
      isMounted = false;
    };
  }, [materialId, topicType, repository]);

  return sections;
}
