import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudyMaterialPage } from '../../../src/components/study/StudyMaterialPage';
import { strings } from '../../../src/constants/strings';
import { StudyMaterialViewModel } from '../../../src/viewmodels/StudyMaterialViewModel';
import { IContentRepository } from '../../../src/repositories/interfaces/IContentRepository';
import { StudyMaterial } from '../../../src/types/testContent';
import { UserProfile } from '../../../src/services/AuthService';

const mockMaterials: StudyMaterial[] = [
  {
    id: 'mat_1',
    title: 'SSB Day 1 Process Guide',
    category: 'OIR',
    testTypeId: 'oir',
    dayNumber: '1',
    summary: 'Comprehensive guide for Day 1 Screening.',
    contentMarkdown: '# Day 1 Guide',
    estimatedReadTimeMinutes: 5,
    tags: ['SSB', 'Day 1', 'OIR'],
    createdAt: '2026-01-01',
  },
  {
    id: 'mat_2',
    title: 'OIR Rating 1 Verbal Rules',
    category: 'OIR',
    testTypeId: 'oir',
    dayNumber: '1',
    summary: 'Tips for solving verbal reasoning quickly.',
    contentMarkdown: '# OIR Rules',
    estimatedReadTimeMinutes: 4,
    tags: ['OIR'],
    createdAt: '2026-01-02',
  },
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

const mockUser: UserProfile = {
  uid: 'user_123',
  email: 'cadet@example.com',
  displayName: 'Cadet Officer',
  photoURL: null,
};

describe('StudyMaterialPage Component', () => {
  it('renders study materials header without offline badge and renders vertical day accordions', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByTestId('study-material-page')).toBeInTheDocument();
      expect(screen.getByText(strings.studyMaterial.title)).toBeInTheDocument();
      expect(screen.queryByTestId('offline-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('ssb-day-accordions-container')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-accordion-1')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-accordion-2')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-accordion-3-4')).toBeInTheDocument();
      expect(screen.getByTestId('study-day-accordion-5')).toBeInTheDocument();
    });
  });

  it('renders all 8 GTO test cards under Day 3 & 4 section', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByTestId('study-day-accordion-3-4')).toBeInTheDocument();
    });

    // Expand Day 3 & 4 Accordion
    const toggleBtn = screen.getByTestId('toggle-accordion-btn-3-4');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('study-test-card-gd')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-gpe')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-pgt')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-hgt')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-iot')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-command_task')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-snake_race')).toBeInTheDocument();
    expect(screen.getByTestId('study-test-card-fgt')).toBeInTheDocument();
  });

  it('displays auth lock banner when user is unauthenticated', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-locked-banner')).toBeInTheDocument();
      expect(screen.getByText(strings.studyMaterial.authLockedTitle)).toBeInTheDocument();
    });
  });

  it('opens accessible StudyReaderModal when unlocked nested material item is clicked', async () => {
    const handleSelect = vi.fn();
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} onSelectMaterial={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByTestId('study-day-accordion-1')).toBeInTheDocument();
    });

    // Open material item under OIR card
    const matItem = screen.getByTestId('nested-material-item-mat_1');
    fireEvent.click(matItem);

    expect(handleSelect).toHaveBeenCalledWith(mockMaterials[0]);
    expect(screen.getByTestId('study-reader-modal')).toBeInTheDocument();
  });

  it('renders tier badges on study cards for UI symmetry', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByTestId('tier-badge-oir')).toHaveTextContent('FREE GUIDE');
      expect(screen.getByTestId('tier-badge-ppdt')).toHaveTextContent('PRO DOSSIER');
    });
  });
});
