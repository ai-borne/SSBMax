// Phase 8 sweep (docs/plans/write-the-phased-plan-wobbly-pancake.md): D4 forbids runtime
// markdown parsing entirely -- StudyReaderModal now always fetches the D2 side document
// (study_material_sections/{materialId}) and renders it via DocumentView; there is no
// markdown-rollback path left to test. `sections === null` is a loading state, not a fallback.
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
  topicType: 'OIR',
};

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
  it('shows a loading state, never markdown, while study_material_sections resolves', () => {
    const repository: IContentRepository = {
      ...unreachableRepository,
      getStudyMaterialSections: vi.fn(() => new Promise<null>(() => {})),
    };

    render(<StudyReaderModal material={material} isOpen onClose={() => {}} contentRepository={repository} />);

    expect(screen.getByTestId('study-reader-modal')).toBeInTheDocument();
    expect(screen.getByTestId('study-reader-loading')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('**');
    expect(document.body.textContent).not.toContain('# OIR Guide');
    expect(screen.queryByTestId('document-view')).not.toBeInTheDocument();
  });

  it('renders nothing when material is null', () => {
    const { container } = render(<StudyReaderModal material={null} isOpen onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches study_material_sections by materialId regardless of topicType', () => {
    const repository: IContentRepository = {
      ...unreachableRepository,
      getStudyMaterialSections: vi.fn(() => new Promise<null>(() => {})),
    };

    render(
      <StudyReaderModal material={material} isOpen onClose={() => {}} contentRepository={repository} />
    );

    expect(repository.getStudyMaterialSections).toHaveBeenCalledWith('mat_1');
  });

  it('renders the D2 side document via DocumentView once it resolves (D4)', async () => {
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

    render(
      <StudyReaderModal material={material} isOpen onClose={() => {}} contentRepository={repository} />
    );

    expect(await screen.findByTestId('document-view')).toBeInTheDocument();
    expect(screen.getByText('Structured intro text')).toBeInTheDocument();
    expect(screen.queryByTestId('study-reader-loading')).not.toBeInTheDocument();
  });

  it('stays in the loading state when no side document has been published yet', async () => {
    const repository: IContentRepository = {
      ...unreachableRepository,
      getStudyMaterialSections: vi.fn().mockResolvedValue(null),
    };

    render(
      <StudyReaderModal material={material} isOpen onClose={() => {}} contentRepository={repository} />
    );

    await waitFor(() => expect(repository.getStudyMaterialSections).toHaveBeenCalledWith('mat_1'));
    expect(screen.getByTestId('study-reader-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('document-view')).not.toBeInTheDocument();
  });
});
