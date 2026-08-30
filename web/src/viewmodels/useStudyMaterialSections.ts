import { useEffect, useState } from 'react';
import { ContentRepository } from '../repositories/ContentRepository';
import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import type { DocumentModel } from '../components/content/blocks/types';

// Module-level singleton default, not `new ContentRepository()` inline in the function
// signature -- an inline default is re-created every call, which would change the effect's
// dependency and re-trigger the fetch on every render for a caller that doesn't inject one.
const defaultContentRepository = new ContentRepository();

/**
 * Fetches the D2 side document `study_material_sections/{materialId}` (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md) for StudyReaderModal -- the authenticated Study
 * tab's reader, the one surface D4 named explicitly ("StudyReaderModal reads published
 * sections like every other surface"). The per-topic rollout flag this used to check was
 * removed in the Phase 8 sweep once it covered all 9 topics. Returns null while the fetch is
 * in flight and if it resolves to nothing (missing `materialId`, or the material has no
 * published side document yet) -- callers cannot distinguish the two from this alone.
 */
export function useStudyMaterialSections(
  materialId: string | undefined,
  repository: IContentRepository = defaultContentRepository
): DocumentModel | null {
  const [sections, setSections] = useState<DocumentModel | null>(null);

  useEffect(() => {
    let isMounted = true;
    // Standard fetch-on-dependency-change reset: clears stale sections from the previous
    // materialId while the new fetch below is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSections(null);

    if (!materialId) {
      return;
    }

    repository.getStudyMaterialSections(materialId).then((result) => {
      if (isMounted) setSections(result);
    });

    return () => {
      isMounted = false;
    };
  }, [materialId, repository]);

  return sections;
}
