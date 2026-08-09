import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import { StudyMaterial } from '../types/testContent';

export class StudyMaterialViewModel {
  private repository: IContentRepository;
  private materials: StudyMaterial[] = [];
  private selectedCategory: string = 'All';
  private completedMaterialIds: Set<string> = new Set();
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
