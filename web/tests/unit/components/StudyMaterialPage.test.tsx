import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudyMaterialPage } from '../../../src/components/study/StudyMaterialPage';
import { strings } from '../../../src/constants/strings';
import { StudyMaterialViewModel } from '../../../src/viewmodels/StudyMaterialViewModel';
import { IContentRepository } from '../../../src/repositories/interfaces/IContentRepository';
import { StudyMaterial } from '../../../src/types/testContent';
import { UserProfile, authService } from '../../../src/services/AuthService';

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
    createdAt: '2026-01-01'
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
    return { id: 't1', setName: 'TAT', imageUrls: [], imageIds: [], slideDurationSeconds: 240, totalSlides: 12 };
  }
  async getWATBatch() {
    return { id: 'w1', words: [], displayDurationSeconds: 15 };
  }
  async getSRTBatch() {
    return { id: 's1', situations: [], totalTimeMinutes: 30 };
  }
  async getGPEBatch() {
    return { id: 'g1', batchIndex: 0, totalItems: 0, items: [] };
  }
  async getOIRContentVersion() {
    return { contentVersion: 1, batchCount: 1 };
  }
  async getAvailableBatches() {
    return [];
  }
  async getStudyMaterialSections() {
    return null;
  }
}


const mockUser: UserProfile = {
  uid: 'user_123',
  email: 'cadet@example.com',
  displayName: 'Cadet Officer',
  photoURL: null
};

describe('StudyMaterialPage Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders zero-CLS skeleton loader prior to material hydration', () => {
    class SlowRepository extends MockContentRepository {
      async getStudyMaterials() {
        return new Promise<StudyMaterial[]>(() => {}); // Never resolves
      }
    }
    const vm = new StudyMaterialViewModel(new SlowRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    expect(screen.getByTestId('study-materials-skeleton')).toBeInTheDocument();
  });

  it('renders study materials header without offline badge and renders vertical day accordions after hydration', async () => {
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

  it('shows a non-blocking soft sign-in CTA (not a content lock) for unauthenticated visitors', async () => {
    const signInSpy = vi.spyOn(authService, 'signInWithGoogle').mockImplementation(async () => mockUser);
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('soft-signin-cta-banner')).toBeInTheDocument();
      expect(screen.getByText(strings.studyMaterial.softCtaTitle)).toBeInTheDocument();
    });

    // No trace of the old hard-lock UI: no locked badges, no "OAuth Required" copy,
    // anywhere in the unauthenticated render.
    expect(screen.queryByTestId('locked-badge-oir')).not.toBeInTheDocument();
    expect(screen.queryByText('Google OAuth Required')).not.toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();

    // Study content is public: an unauthenticated visitor can open a material directly,
    // with no sign-in redirect and no gating on the click.
    const matItem = await screen.findByTestId('nested-material-item-mat_1');
    fireEvent.click(matItem);
    expect(screen.getByTestId('study-reader-modal')).toBeInTheDocument();
    expect(signInSpy).not.toHaveBeenCalled();

    // "Mark as read" -- previously an unlocked-only affordance -- also works unauthenticated.
    const toggleBtn = screen.getByTestId('toggle-completed-mat_1');
    fireEvent.click(toggleBtn);
    expect(vm.isCompleted('mat_1')).toBe(true);

    // The CTA button itself still offers sign-in, for progress sync -- and only the CTA
    // triggers it, nothing content-related does.
    fireEvent.click(screen.getByTestId('soft-signin-cta-btn'));
    expect(signInSpy).toHaveBeenCalledTimes(1);
  });

  it('opens accessible StudyReaderModal when a nested material item is clicked', async () => {
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

  it('filters study materials dynamically when search query is entered', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByTestId('search-materials-input')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-materials-input');
    fireEvent.change(searchInput, { target: { value: 'Verbal' } });

    await waitFor(() => {
      expect(screen.queryByTestId('nested-material-item-mat_1')).not.toBeInTheDocument();
      expect(screen.getByTestId('nested-material-item-mat_2')).toBeInTheDocument();
    });
  });

  it('renders tier badges on study cards for UI symmetry', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByTestId('tier-badge-oir')).toHaveTextContent('FREE GUIDE');
      expect(screen.getByTestId('tier-badge-ppdt')).toHaveTextContent('PRO DOSSIER');
    });
  });

  it('applies Level 1 elevation to study accordion container and Level 2 elevation to study cards', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    render(<StudyMaterialPage viewModel={vm} user={mockUser} />);

    await waitFor(() => {
      const accordion = screen.getByTestId('study-day-accordion-1');
      expect(accordion.className).toContain('dark:bg-slate-900');
      expect(accordion.className).toContain('dark:border-slate-800');

      const card = screen.getByTestId('study-test-card-oir');
      expect(card.className).toContain('dark:bg-slate-800/90');
      expect(card.className).toContain('dark:border-slate-700/80');
      expect(card.className).toContain('shadow-[var(--card-shadow)]');
    });
  });

  it('auto-reloads study materials when auth state changes from unauthenticated to authenticated', async () => {
    let authCallback: ((user: UserProfile | null) => void) | null = null;
    vi.spyOn(authService, 'onAuthStateChanged').mockImplementation((cb) => {
      authCallback = cb;
      return () => {};
    });

    const repo = new MockContentRepository();
    const loadSpy = vi.spyOn(repo, 'getStudyMaterials');
    const vm = new StudyMaterialViewModel(repo);

    render(<StudyMaterialPage viewModel={vm} />);

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    // Simulate auth state change (User signs in)
    if (authCallback) {
      act(() => {
        (authCallback as (user: UserProfile | null) => void)(mockUser);
      });
    }

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('handles network error in loadMaterials during auth state change gracefully', async () => {
    let authCallback: ((user: UserProfile | null) => void) | null = null;
    vi.spyOn(authService, 'onAuthStateChanged').mockImplementation((cb) => {
      authCallback = cb;
      return () => {};
    });

    class NetworkFailingRepository extends MockContentRepository {
      async getStudyMaterials(): Promise<StudyMaterial[]> {
        throw new Error('Network timeout or Firestore connection failed');
      }
    }

    const vm = new StudyMaterialViewModel(new NetworkFailingRepository());
    render(<StudyMaterialPage viewModel={vm} />);

    await waitFor(() => {
      // Skeleton loader finishes (materialsLoaded = true) even on network failure
      expect(screen.queryByTestId('study-materials-skeleton')).not.toBeInTheDocument();
    });

    // Trigger auth state change during network failure
    if (authCallback) {
      act(() => {
        (authCallback as (user: UserProfile | null) => void)(mockUser);
      });
    }

    await waitFor(() => {
      expect(screen.queryByTestId('study-materials-skeleton')).not.toBeInTheDocument();
    });
  });
});


