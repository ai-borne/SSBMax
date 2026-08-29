import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DocumentView } from '../../../src/components/content/DocumentView';
import type { DocumentModel } from '../../../src/components/content/blocks/types';

/**
 * Phase 7 reading affordances (docs/plans/write-the-phased-plan-wobbly-pancake.md): per-section
 * read toggle and the "Practice this now" CTA. All new props are optional -- when omitted (the
 * public prerendered path via StudyTopicPage/prerenderHtml.mjs), DocumentView must render exactly
 * as it did before this phase, so that's asserted first.
 */
describe('DocumentView reading affordances', () => {
  const model: DocumentModel = {
    sections: [
      { id: 's1', slug: 's1', heading: 'Section One', level: 2, blocks: [{ type: 'paragraph', text: 'Some prose.' }] },
    ],
  };

  it('renders no read toggle or CTA when the affordance props are omitted', () => {
    const { queryByTestId } = render(<DocumentView model={model} />);

    expect(queryByTestId('section-read-toggle-s1')).toBeNull();
    expect(queryByTestId('document-practice-cta')).toBeNull();
  });

  it('calls onToggleSectionRead with the section id when the read toggle is clicked', () => {
    const onToggle = vi.fn();
    const { getByTestId } = render(
      <DocumentView model={model} readSectionIds={new Set()} onToggleSectionRead={onToggle} />
    );

    fireEvent.click(getByTestId('section-read-toggle-s1'));

    expect(onToggle).toHaveBeenCalledWith('s1');
  });

  it('renders the CTA and calls onPracticeClick with the resolved testTypeId', () => {
    const onPractice = vi.fn();
    const { getByTestId } = render(
      <DocumentView model={model} practiceTestTypeId="oir" onPracticeClick={onPractice} />
    );

    fireEvent.click(getByTestId('document-practice-cta'));

    expect(onPractice).toHaveBeenCalledWith('oir');
  });

  it('renders no CTA when practiceTestTypeId is undefined (ambiguous topicType)', () => {
    const onPractice = vi.fn();
    const { queryByTestId } = render(<DocumentView model={model} onPracticeClick={onPractice} />);

    expect(queryByTestId('document-practice-cta')).toBeNull();
  });
});
