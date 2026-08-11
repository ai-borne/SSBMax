import { collection, doc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';
import { IContentRepository } from './interfaces/IContentRepository';
import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo, GPEImage, OIRContentMeta } from '../types/testContent';
import { ContentUnavailableError } from '../types/errors';
import { getFallbackStudyMaterials, getFallbackStudyMaterialById } from '../constants/fallbackStudyMaterials';
import {
  mapDocToWATBatch,
  mapDocToSRTBatch,
  mapDocToTATSet,
  mapDocToPPDTContext,
  mapDocToOIRBatch,
  mapDocToGPEBatch
} from './mappers/testContentMappers';

import {
  getFallbackOIRBatch,
  getFallbackPPDTContext,
  getFallbackTATSet,
  getFallbackWATBatch,
  getFallbackSRTBatch
} from '../constants/fallbackTestContent';

export class ContentRepository implements IContentRepository {
  async getStudyMaterials(): Promise<StudyMaterial[]> {
    try {
      const querySnapshot = await getDocs(query(collection(db, FirestorePaths.STUDY_MATERIALS), limit(50)));
      const materials: StudyMaterial[] = [];
      querySnapshot.forEach((docSnap) => {
        materials.push(this.mapDocToStudyMaterial(docSnap.id, docSnap.data()));
      });
      return materials.length > 0 ? materials : getFallbackStudyMaterials();
    } catch (error) {
      console.warn('Failed to fetch study materials from Firestore, using offline fallback', error);
      return getFallbackStudyMaterials();
    }
  }

  async getStudyMaterialById(id: string): Promise<StudyMaterial | null> {
    try {
      const docSnap = await getDoc(doc(db, FirestorePaths.STUDY_MATERIALS, id));
      if (!docSnap.exists()) {
        return getFallbackStudyMaterialById(id);
      }
      return this.mapDocToStudyMaterial(docSnap.id, docSnap.data());
    } catch (error) {
      console.warn(`Failed to fetch study material ${id}, checking offline fallback`, error);
      return getFallbackStudyMaterialById(id);
    }
  }

  private mapDocToStudyMaterial(id: string, data: Record<string, any>): StudyMaterial {
    const rawTestType = data.testTypeId || data.topicType || data.category;
    const content = data.contentMarkdown || data.introduction || data.content || '';
    const readTime = typeof data.readTime === 'number'
      ? data.readTime
      : typeof data.estimatedReadTimeMinutes === 'number'
      ? data.estimatedReadTimeMinutes
      : parseInt(String(data.readTime || '5'), 10) || 5;

    return {
      id,
      title: data.title || '',
      category: data.category || data.topicType || 'General',
      summary: data.summary || (content ? content.slice(0, 150) + '...' : ''),
      contentMarkdown: content,
      estimatedReadTimeMinutes: readTime,
      tags: data.tags || [],
      createdAt: typeof data.lastUpdated === 'number' ? new Date(data.lastUpdated).toISOString() : data.createdAt || new Date().toISOString(),
      dayNumber: data.dayNumber ? (String(data.dayNumber) as StudyMaterial['dayNumber']) : undefined,
      testTypeId: this.parseTestTypeId(rawTestType)
    };
  }

  private parseTestTypeId(val: unknown): StudyMaterial['testTypeId'] {
    if (typeof val !== 'string') return undefined;
    const norm = val.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const valid: StudyMaterial['testTypeId'][] = [
      'oir', 'ppdt', 'piq', 'tat', 'wat', 'srt', 'sd', 'gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt', 'interview', 'conference'
    ];
    if (valid.includes(norm as StudyMaterial['testTypeId'])) return norm as StudyMaterial['testTypeId'];
    const keywordMap: Array<[string, StudyMaterial['testTypeId']]> = [
      ['oir', 'oir'], ['ppdt', 'ppdt'], ['piq', 'piq'], ['tat', 'tat'], ['psychology', 'tat'],
      ['wat', 'wat'], ['srt', 'srt'], ['sd', 'sd'], ['self', 'sd'], ['gd', 'gd'], ['discussion', 'gd'],
      ['gpe', 'gpe'], ['planning', 'gpe'], ['pgt', 'pgt'], ['hgt', 'hgt'], ['iot', 'iot'], ['obstacle', 'iot'],
      ['command', 'command_task'], ['snake', 'snake_race'], ['gor', 'snake_race'], ['fgt', 'fgt'],
      ['interview', 'interview'], ['conference', 'conference'], ['medicals', 'conference']
    ];
    const match = keywordMap.find(([kw]) => norm.includes(kw));
    return match ? match[1] : undefined;
  }

  /**
   * KMP-authoritative doc-id convention for OIR batches: `batch_pdf_{NNN}`, 1-indexed.
   */
  async getOIRQuestions(batchIndex = 0): Promise<BatchDocument<OIRQuestion>> {
    const batchId = `batch_pdf_${String(batchIndex + 1).padStart(3, '0')}`;
    try {
      const snap = await getDoc(doc(db, FirestorePaths.TestContent.OIR_BATCHES, batchId));
      if (!snap.exists()) {
        throw new ContentUnavailableError(`OIR batch ${batchId} is unavailable`);
      }
      return mapDocToOIRBatch(snap.id, snap.data(), batchIndex);
    } catch (error: any) {
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || error?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for OIR batch ${batchId}:`, error?.message || error);
        return getFallbackOIRBatch(batchIndex);
      }
      throw error;
    }
  }

  async getPPDTContext(id = 'ppdt_1'): Promise<PPDTContext> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.TestContent.PPDT_BATCHES, id));
      if (!snap.exists()) {
        throw new ContentUnavailableError(`PPDT context ${id} is unavailable`);
      }
      return mapDocToPPDTContext(id, snap.data());
    } catch (error: any) {
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || error?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for PPDT context ${id}:`, error?.message || error);
        return getFallbackPPDTContext(id);
      }
      throw error;
    }
  }

  async getTATSet(id = 'tat_set_1'): Promise<TATSet> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.TestContent.TAT_BATCHES, id));
      if (!snap.exists()) {
        throw new ContentUnavailableError(`TAT set ${id} is unavailable`);
      }
      return mapDocToTATSet(snap.id, snap.data());
    } catch (error: any) {
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || error?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for TAT set ${id}:`, error?.message || error);
        return getFallbackTATSet(id);
      }
      throw error;
    }
  }

  async getWATBatch(id = 'wat_batch_1'): Promise<WATBatch> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.TestContent.WAT_BATCHES, id));
      if (!snap.exists()) {
        throw new ContentUnavailableError(`WAT batch ${id} is unavailable`);
      }
      return mapDocToWATBatch(id, snap.data());
    } catch (error: any) {
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || error?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for WAT batch ${id}:`, error?.message || error);
        return getFallbackWATBatch(id);
      }
      throw error;
    }
  }

  async getSRTBatch(id = 'srt_batch_1'): Promise<SRTBatch> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.TestContent.SRT_BATCHES, id));
      if (!snap.exists()) {
        throw new ContentUnavailableError(`SRT batch ${id} is unavailable`);
      }
      return mapDocToSRTBatch(id, snap.data());
    } catch (error: any) {
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || error?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for SRT batch ${id}:`, error?.message || error);
        return getFallbackSRTBatch(id);
      }
      throw error;
    }
  }

  async getGPEBatch(id = 'batch_001', batchIndex = 0): Promise<BatchDocument<GPEImage>> {
    const snap = await getDoc(doc(db, FirestorePaths.TestContent.GPE_BATCHES, id));
    if (!snap.exists()) {
      throw new ContentUnavailableError(`GPE batch ${id} is unavailable`);
    }
    return mapDocToGPEBatch(snap.id, snap.data(), batchIndex);
  }

  async getOIRContentVersion(): Promise<OIRContentMeta> {
    const snap = await getDoc(doc(db, FirestorePaths.TestContent.OIR_META_CONFIG));
    if (!snap.exists()) {
      throw new ContentUnavailableError('OIR content-version doc is unavailable');
    }
    const data = snap.data();
    const batchCount = typeof data.batchCount === 'number' ? data.batchCount : undefined;
    if (batchCount === undefined) {
      throw new ContentUnavailableError('OIR content-version doc is missing batchCount');
    }
    return {
      contentVersion: typeof data.contentVersion === 'number' ? data.contentVersion : 0,
      batchCount
    };
  }

  async getAvailableBatches(moduleName: string): Promise<TestBatchInfo[]> {
    const normModule = moduleName.toLowerCase().trim();
    const subcollMap: Record<string, string> = {
      oir: 'batches',
      ppdt: 'image_batches',
      tat: 'image_batches',
      wat: 'word_batches',
      srt: 'situation_batches',
      gto: 'task_batches'
    };
    const subcoll = subcollMap[normModule];
    if (!subcoll) {
      return [];
    }

    try {
      const snap = await getDocs(collection(db, FirestorePaths.TEST_CONTENT, normModule, subcoll));
      if (snap.empty) {
        return [];
      }
      const batches: TestBatchInfo[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const count = d.totalItems || d.totalWords || d.totalSituations || (d.words?.length) || (d.situations?.length) || (d.imageUrls?.length) || (d.items?.length) || (d.questions?.length);
        batches.push({
          id: docSnap.id,
          name: d.name || d.setName || d.title || `Batch ${batches.length + 1}`,
          itemCount: typeof count === 'number' ? count : undefined
        });
      });
      return batches;
    } catch (error) {
      console.warn(`Failed to query batches for module ${normModule}`, error);
      return [];
    }
  }
}
