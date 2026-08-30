import { useCallback, useState } from 'react';

const READ_SECTIONS_STORAGE_KEY = 'ssbmax_read_sections';

// Per-section read state (Phase 7, docs/plans/write-the-phased-plan-wobbly-pancake.md). Study
// content is public (unauthenticated visitors included), so like `StudyMaterialViewModel`'s
// material-level completion tracking, localStorage is the only persistence available -- there is
// no server-side home for an anonymous reader's per-section progress.
function loadReadSectionIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_SECTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function persistReadSectionIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READ_SECTIONS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private browsing / quota exceeded -- read state falls back to in-memory only
  }
}

export interface SectionReadState {
  readSectionIds: Set<string>;
  isSectionRead: (sectionId: string) => boolean;
  toggleSectionRead: (sectionId: string) => void;
}

export function useSectionReadState(): SectionReadState {
  const [readSectionIds, setReadSectionIds] = useState<Set<string>>(() => loadReadSectionIds());

  const toggleSectionRead = useCallback((sectionId: string) => {
    setReadSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      persistReadSectionIds(next);
      return next;
    });
  }, []);

  const isSectionRead = useCallback((sectionId: string) => readSectionIds.has(sectionId), [readSectionIds]);

  return { readSectionIds, isSectionRead, toggleSectionRead };
}
