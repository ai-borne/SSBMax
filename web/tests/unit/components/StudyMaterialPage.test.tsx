import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudyMaterialPage } from '../../../src/components/study/StudyMaterialPage';
import { strings } from '../../../src/constants/strings';
import { StudyMaterialViewModel } from '../../../src/viewmodels/StudyMaterialViewModel';
import { IContentRepository } from '../../../src/repositories/interfaces/IContentRepository';
import { StudyMaterial } from '../../../src/types/testContent';

const mockMaterials: StudyMaterial[] = [
  {
    id: 'mat_1',
    title: 'SSB Day 1 Process Guide',
    category: 'SSB Basics',
    summary: 'Comprehensive guide for Day 1 Screening.',
    contentMarkdown: '# Day 1 Guide',
    estimatedReadTimeMinutes: 5,
    tags: ['SSB', 'Day 1'],
    createdAt: '2026-01-01'
  },
  {
    id: 'mat_2',
    title: 'OIR Rating 1 Verbal Rules',
    category: 'OIR',
    summary: 'Tips for solving verbal reasoning quickly.',
    contentMarkdown: '# OIR Rules',
    estimatedReadTimeMinutes: 4,
    tags: ['OIR'],
    createdAt: '2026-01-02'
  }
];

class MockContentRepository implements IContentRepository {
  async getStudyMaterials() {
    return mockMaterials;
  }
  async getStudyMaterialById(id: string) {
    return mockMaterials.find((m) => m.id === id) || null;
  }
  async getOIRQuestions() {
    return { id: 'b1', batchIndex: 0, totalItems: 0, items: [] };
  }
  async getPPDTContext() {
    return { id: 'p1', title: 'PPDT', imageUrl: '', viewingTimeSeconds: 30, writingTimeSeconds: 240, instructions: [] };
  }
  async getTATSet() {
    return { id: 't1', setName: 'TAT', imageUrls: [], slideDurationSeconds: 240, totalSlides: 12 };
  }
  async getWATBatch() {
    return { id: 'w1', words: [], displayDurationSeconds: 15 };
  }
  async getSRTBatch() {
    return { id: 's1', situations: [], totalTimeMinutes: 30 };
  }
  async getCappedBatch<T>(_collectionName: string, batchIndex = 0, _maxItems = 50) {
    return { id: `batch_${batchIndex}`, batchIndex, totalItems: 0, items: [] as T[] };
  }
}

describe('StudyMaterialPage Component', () => {
  it('renders study materials header, offline badge, day modules grid, category tabs, and material cards', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} />);

    await waitFor(() => {
      expect(screen.getByTestId('study-material-page')).toBeInTheDocument();
      expect(screen.getByText(strings.studyMaterial.title)).toBeInTheDocument();
      expect(screen.getByTestId('offline-badge')).toBeInTheDocument();
      expect(screen.getByTestId('ssb-day-modules-grid')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-card-3-4')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-card-5')).toBeInTheDocument();
      expect(screen.getByTestId('material-card-mat_1')).toBeInTheDocument();
      expect(screen.getByTestId('material-card-mat_2')).toBeInTheDocument();
    });
  });

  it('filters materials when category tab is clicked', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} />);

    await waitFor(() => {
      expect(screen.getByTestId('material-card-mat_1')).toBeInTheDocument();
    });

    const oirTab = screen.getByTestId('category-tab-oir');
    fireEvent.click(oirTab);

    expect(screen.queryByTestId('material-card-mat_1')).not.toBeInTheDocument();
    expect(screen.getByTestId('material-card-mat_2')).toBeInTheDocument();
  });

  it('opens accessible StudyReaderModal with ARIA attributes when a card is clicked', async () => {
    const handleSelect = vi.fn();
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} onSelectMaterial={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByTestId('material-card-mat_1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('material-card-mat_1'));

    expect(handleSelect).toHaveBeenCalledWith(mockMaterials[0]);
    const readerModal = screen.getByTestId('study-reader-modal');
    expect(readerModal).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByTestId('modal-close-button');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('study-reader-modal')).not.toBeInTheDocument();
  });

  it('toggles mark as completed state on material card', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} />);

    await waitFor(() => {
      expect(screen.getByTestId('mark-read-btn-mat_1')).toBeInTheDocument();
    });

    const markBtn = screen.getByTestId('mark-read-btn-mat_1');
    expect(markBtn).toHaveTextContent(strings.studyMaterial.markAsRead);

    fireEvent.click(markBtn);

    expect(markBtn).toHaveTextContent(strings.studyMaterial.completed);
  });
});
