import { describe, it, expect } from 'vitest';
import { StudyMaterialViewModel } from '../../src/viewmodels/StudyMaterialViewModel';
import { IContentRepository } from '../../src/repositories/interfaces/IContentRepository';
import { StudyMaterial, BatchDocument, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, GPEImage, OIRContentMeta } from '../../src/types/testContent';

class MockContentRepository implements IContentRepository {
  async getStudyMaterials(): Promise<StudyMaterial[]> {
    return [
      {
        id: 'mat_1',
        title: 'OIR Prep Guide',
        category: 'OIR',
        summary: 'Guide for OIR test',
        contentMarkdown: '# OIR Guide',
        estimatedReadTimeMinutes: 5,
        tags: ['OIR'],
        createdAt: '2026-01-01'
      },
      {
        id: 'mat_2',
        title: 'PPDT Story Writing',
        category: 'Psychology',
        summary: 'PPDT guide',
        contentMarkdown: '# PPDT Guide',
        estimatedReadTimeMinutes: 10,
        tags: ['PPDT'],
        createdAt: '2026-01-02'
      }
    ];
  }

  async getStudyMaterialById(id: string): Promise<StudyMaterial | null> {
    const materials = await this.getStudyMaterials();
    return materials.find((m) => m.id === id) || null;
  }

  async getOIRQuestions(_batchIndex = 0): Promise<BatchDocument<OIRQuestion>> {
    return { id: 'batch_0', batchIndex: 0, totalItems: 0, items: [] };
  }

  async getPPDTContext(): Promise<PPDTContext> {
    return {
      id: 'ppdt-1',
      title: 'PPDT',
      imageUrl: 'https://example.com/img.jpg',
      viewingTimeSeconds: 30,
      writingTimeSeconds: 240,
      instructions: []
    };
  }

  async getTATSet(): Promise<TATSet> {
    return { id: 'tat-1', setName: 'Set 1', imageUrls: [], imageIds: [], slideDurationSeconds: 240, totalSlides: 0 };
  }

  async getWATBatch(): Promise<WATBatch> {
    return { id: 'wat-1', words: [], displayDurationSeconds: 15 };
  }

  async getSRTBatch(): Promise<SRTBatch> {
    return { id: 'srt-1', situations: [], totalTimeMinutes: 30 };
  }

  async getGPEBatch(): Promise<BatchDocument<GPEImage>> {
    return { id: 'gpe-1', batchIndex: 0, totalItems: 0, items: [] };
  }

  async getOIRContentVersion(): Promise<OIRContentMeta> {
    return { contentVersion: 1, batchCount: 1 };
  }

  async getAvailableBatches(): Promise<any[]> {
    return [];
  }
}


describe('StudyMaterialViewModel Unit Tests', () => {
  it('should load study materials and populate categories', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    await vm.loadMaterials();

    expect(vm.getMaterials().length).toBe(2);
    expect(vm.getCategories()).toEqual(['All', 'OIR', 'Psychology']);
  });

  it('should filter materials by selected category', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    await vm.loadMaterials();

    vm.setCategoryFilter('OIR');
    const filtered = vm.getFilteredMaterials();

    expect(filtered.length).toBe(1);
    expect(filtered[0].category).toBe('OIR');
  });

  it('should track completed material state correctly', async () => {
    const vm = new StudyMaterialViewModel(new MockContentRepository());
    expect(vm.isCompleted('mat_1')).toBe(false);

    vm.markAsCompleted('mat_1');
    expect(vm.isCompleted('mat_1')).toBe(true);
  });
});
