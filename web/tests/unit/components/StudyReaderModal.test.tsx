// Follow-up to the ai_search_readiness/GEO plan's public-content markdown-rendering fix
// (StudyTopicPage.tsx, prerenderHtml.mjs): StudyReaderModal has the same bug for
// Firestore-runtime-fed StudyMaterial content -- this is the authenticated Study tab's
// reader, un-gated for anonymous visitors since Phase 4, so it renders the same kind of
// public-facing prose. Verifies markdown is parsed to real HTML, not shown as literal syntax.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StudyReaderModal } from '../../../src/components/study/StudyReaderModal';
import { StudyMaterial } from '../../../src/types/testContent';
import { IContentRepository } from '../../../src/repositories/interfaces/IContentRepository';
import type { DocumentModel } from '../../../src/components/content/blocks/types';

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

// A repository whose getStudyMaterialSections is never expected to be called just throws --
// makes an accidental fetch (e.g. the "no topicType" / "flag disabled" guard regressing) fail
// loudly instead of silently passing because a mock happened to resolve something harmless.
const unreachableRepository: IContentRepository = {
  getStudyMaterials: () => { throw new Error('not stubbed'); },
  getStudyMaterialById: () => { throw new Error('not stubbed'); },
  getOIRQuestions: () => { throw new Error('not stubbed'); },
  getPPDTContext: () => { throw new Error('not stubbed'); },
  getTATSet: () => { throw new Error('not stubbed'); },
  getWATBatch: () => { throw new Error('not stubbed'); },
  getSRTBatch: () => { throw new Error('not stubbed'); },
  getGPEBatch: () => { throw new Error('not stubbed'); },
  getOIRContentVersion: () => { throw new Error('not stubbed'); },
  getAvailableBatches: () => { throw new Error('not stubbed'); },
  getStudyMaterialSections: () => { throw new Error('getStudyMaterialSections should not have been called'); },
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

  it('never fetches study_material_sections for a material with no topicType (falls straight to markdown)', () => {
    render(
      <StudyReaderModal
        material={material}
        isOpen
        onClose={() => {}}
        contentRepository={unreachableRepository}
      />
    );

    expect(screen.getByText('Focus on speed.')).toBeInTheDocument();
  });

  it('renders the D2 side document via DocumentView, not markdown, once it resolves (D4)', async () => {
    const model: DocumentModel = {
      sections: [
        {
          id: 'study-materials/oir_1.md#0',
          slug: 'intro',
          heading: null,
          level: 0,
          blocks: [{ type: 'paragraph', text: 'Structured intro text' }],
        },
      ],
    };
    const repository: IContentRepository = {
      ...unreachableRepository,
      getStudyMaterialSections: vi.fn().mockResolvedValue(model),
    };
    const oirMaterial: StudyMaterial = { ...material, topicType: 'OIR' };

    render(
      <StudyReaderModal material={oirMaterial} isOpen onClose={() => {}} contentRepository={repository} />
    );

    expect(await screen.findByTestId('document-view')).toBeInTheDocument();
    expect(screen.getByText('Structured intro text')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Focus on speed.'); // markdown fallback did not also render
  });

  it('falls back to markdown when the topic is enabled but no side document has been published yet', async () => {
    const repository: IContentRepository = {
      ...unreachableRepository,
      getStudyMaterialSections: vi.fn().mockResolvedValue(null),
    };
    const oirMaterial: StudyMaterial = { ...material, topicType: 'OIR' };

    render(
      <StudyReaderModal material={oirMaterial} isOpen onClose={() => {}} contentRepository={repository} />
    );

    await waitFor(() => expect(repository.getStudyMaterialSections).toHaveBeenCalledWith('mat_1'));
    expect(screen.getByText('Focus on speed.')).toBeInTheDocument();
    expect(screen.queryByTestId('document-view')).not.toBeInTheDocument();
  });

  it('falls back to markdown for a topicType outside the structured-rendering rollout', () => {
    const oirMaterial: StudyMaterial = { ...material, topicType: 'NOT_A_REAL_TOPIC' };

    render(
      <StudyReaderModal
        material={oirMaterial}
        isOpen
        onClose={() => {}}
        contentRepository={unreachableRepository}
      />
    );

    expect(screen.getByText('Focus on speed.')).toBeInTheDocument();
  });
});
