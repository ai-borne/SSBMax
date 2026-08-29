// Follow-up to the ai_search_readiness/GEO plan's public-content markdown-rendering fix
// (StudyTopicPage.tsx, prerenderHtml.mjs): StudyReaderModal has the same bug for
// Firestore-runtime-fed StudyMaterial content -- this is the authenticated Study tab's
// reader, un-gated for anonymous visitors since Phase 4, so it renders the same kind of
// public-facing prose. Verifies markdown is parsed to real HTML, not shown as literal syntax.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudyReaderModal } from '../../../src/components/study/StudyReaderModal';
import { StudyMaterial } from '../../../src/types/testContent';

const material: StudyMaterial = {
  id: 'mat_1',
  title: 'OIR Preparation Strategies',
  category: 'OIR',
  summary: 'Summary',
  contentMarkdown: '# OIR Guide\n\n**Focus on speed.**\n\n- Practice daily\n- Track accuracy',
  estimatedReadTimeMinutes: 5,
  tags: [],
  createdAt: new Date().toISOString(),
};

describe('StudyReaderModal', () => {
  it('renders markdown content as real HTML, not literal syntax', () => {
    render(<StudyReaderModal material={material} isOpen onClose={() => {}} />);

    expect(screen.getByTestId('study-reader-modal')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('**');
    expect(document.body.textContent).not.toContain('# OIR Guide');
    expect(screen.getByText('Focus on speed.')).toBeInTheDocument();
    expect(screen.getByText('Practice daily')).toBeInTheDocument();
  });

  it("nests the content's own heading under the modal's <h2> title instead of emitting a competing <h1>", () => {
    render(<StudyReaderModal material={material} isOpen onClose={() => {}} />);

    expect(document.querySelectorAll('h1')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 2, name: 'OIR Guide' })).toBeInTheDocument();
  });

  it('renders nothing when material is null', () => {
    const { container } = render(<StudyReaderModal material={null} isOpen onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
