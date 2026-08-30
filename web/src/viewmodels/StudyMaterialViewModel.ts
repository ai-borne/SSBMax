import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import { StudyMaterial } from '../types/testContent';

const COMPLETED_MATERIALS_STORAGE_KEY = 'ssbmax_completed_study_materials';

// Study content is public (unauthenticated visitors included), so "mark as read" has no
// server-side home -- localStorage is the only persistence available for anonymous readers.
function loadCompletedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(COMPLETED_MATERIALS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function persistCompletedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPLETED_MATERIALS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private browsing / quota exceeded -- completion state falls back to in-memory only
  }
}

export class StudyMaterialViewModel {
  private repository: IContentRepository;
  private materials: StudyMaterial[] = [];
  private selectedCategory: string = 'All';
  private completedMaterialIds: Set<string> = loadCompletedIds();
  private isLoading: boolean = false;
  private errorMessage: string | null = null;

  constructor(repository: IContentRepository) {
    this.repository = repository;
  }

  async loadMaterials(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      this.materials = await this.repository.getStudyMaterials();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load materials';
    } finally {
      this.isLoading = false;
    }
  }

  setCategoryFilter(category: string): void {
    this.selectedCategory = category;
  }

  markAsCompleted(id: string): void {
    this.completedMaterialIds.add(id);
    persistCompletedIds(this.completedMaterialIds);
  }

  isCompleted(id: string): boolean {
    return this.completedMaterialIds.has(id);
  }

  getFilteredMaterials(): StudyMaterial[] {
    if (this.selectedCategory === 'All') {
      return this.materials;
    }
    return this.materials.filter((m) => m.category.toLowerCase() === this.selectedCategory.toLowerCase());
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    this.materials.forEach((m) => categories.add(m.category));
    return ['All', ...Array.from(categories)];
  }

  getMaterials(): StudyMaterial[] {
    return this.materials;
  }

  getSelectedCategory(): string {
    return this.selectedCategory;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getErrorMessage(): string | null {
    return this.errorMessage;
  }
}
