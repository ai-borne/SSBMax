import { collection, doc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { IContentRepository } from './interfaces/IContentRepository';
import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo } from '../types/testContent';
import { getFallbackStudyMaterials, getFallbackStudyMaterialById } from '../constants/fallbackStudyMaterials';
import {
  mapDocToWATBatch,
  mapDocToSRTBatch,
  mapDocToTATSet,
  mapDocToPPDTContext,
  mapDocToOIRBatch
} from './mappers/testContentMappers';

export class ContentRepository implements IContentRepository {
  private static readonly MAX_BATCH_ITEMS = 50;

  async getStudyMaterials(): Promise<StudyMaterial[]> {
    try {
      let querySnapshot = await getDocs(query(collection(db, 'study_materials'), limit(50)));
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(query(collection(db, 'studyMaterials'), limit(50)));
      }
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
      let docRef = doc(db, 'study_materials', id);
      let docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        docRef = doc(db, 'studyMaterials', id);
        docSnap = await getDoc(docRef);
      }
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
    if (norm.includes('oir')) return 'oir';
    if (norm.includes('ppdt')) return 'ppdt';
    if (norm.includes('piq')) return 'piq';
    if (norm.includes('tat') || norm.includes('psychology')) return 'tat';
    if (norm.includes('wat')) return 'wat';
    if (norm.includes('srt')) return 'srt';
    if (norm.includes('sd') || norm.includes('self')) return 'sd';
    if (norm.includes('gd') || norm.includes('discussion')) return 'gd';
    if (norm.includes('gpe') || norm.includes('planning')) return 'gpe';
    if (norm.includes('pgt')) return 'pgt';
    if (norm.includes('hgt')) return 'hgt';
    if (norm.includes('iot') || norm.includes('obstacle')) return 'iot';
    if (norm.includes('command')) return 'command_task';
    if (norm.includes('snake') || norm.includes('gor')) return 'snake_race';
    if (norm.includes('fgt')) return 'fgt';
    if (norm.includes('interview')) return 'interview';
    if (norm.includes('conference') || norm.includes('medicals')) return 'conference';
    return undefined;
  }

  async getOIRQuestions(batchIndex = 0): Promise<BatchDocument<OIRQuestion>> {
    try {
      const docId = `batch_${batchIndex}`;
      const ssotRef = doc(db, 'test_content', 'oir', 'question_batches', docId);
      const ssotSnap = await getDoc(ssotRef);
      if (ssotSnap.exists()) {
        return mapDocToOIRBatch(ssotSnap.id, ssotSnap.data(), batchIndex);
      }
    } catch (err) {
      console.warn(`SSOT OIR fetch failed for batch_${batchIndex}, trying legacy fallback`, err);
    }
    return this.getCappedBatch<OIRQuestion>('oirQuestions', batchIndex);
  }

  async getPPDTContext(id = 'ppdt_1'): Promise<PPDTContext> {
    try {
      const ssotRef = doc(db, 'test_content', 'ppdt', 'image_batches', id);
      const ssotSnap = await getDoc(ssotRef);
      if (ssotSnap.exists()) {
        return mapDocToPPDTContext(ssotSnap.id, ssotSnap.data());
      }
      const docRef = doc(db, 'ppdtContexts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return mapDocToPPDTContext(docSnap.id, docSnap.data());
      }
    } catch (error) {
      console.warn('Using offline fallback for PPDT context', error);
    }
    return mapDocToPPDTContext(id);
  }

  async getTATSet(id = 'tat_set_1'): Promise<TATSet> {
    try {
      const ssotRef = doc(db, 'test_content', 'tat', 'image_batches', id);
      const ssotSnap = await getDoc(ssotRef);
      if (ssotSnap.exists()) {
        return mapDocToTATSet(ssotSnap.id, ssotSnap.data());
      }
      const docRef = doc(db, 'tatSets', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return mapDocToTATSet(docSnap.id, docSnap.data());
      }
    } catch (error) {
      console.warn('Using offline fallback for TAT set', error);
    }
    return mapDocToTATSet(id);
  }

  async getWATBatch(id = 'wat_batch_1'): Promise<WATBatch> {
    try {
      const ssotRef = doc(db, 'test_content', 'wat', 'word_batches', id);
      const ssotSnap = await getDoc(ssotRef);
      if (ssotSnap.exists()) {
        return mapDocToWATBatch(ssotSnap.id, ssotSnap.data());
      }
      const docRef = doc(db, 'watBatches', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return mapDocToWATBatch(docSnap.id, docSnap.data());
      }
    } catch (error) {
      console.warn('Using offline fallback for WAT batch', error);
    }
    return mapDocToWATBatch(id);
  }

  async getSRTBatch(id = 'srt_batch_1'): Promise<SRTBatch> {
    try {
      const ssotRef = doc(db, 'test_content', 'srt', 'situation_batches', id);
      const ssotSnap = await getDoc(ssotRef);
      if (ssotSnap.exists()) {
        return mapDocToSRTBatch(ssotSnap.id, ssotSnap.data());
      }
      const docRef = doc(db, 'srtBatches', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return mapDocToSRTBatch(docSnap.id, docSnap.data());
      }
    } catch (error) {
      console.warn('Using offline fallback for SRT batch', error);
    }
    return mapDocToSRTBatch(id);
  }

  async getCappedBatch<T>(
    collectionName: string,
    batchIndex = 0,
    maxItems = ContentRepository.MAX_BATCH_ITEMS
  ): Promise<BatchDocument<T>> {
    try {
      const docId = `batch_${batchIndex}`;
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return this.getFallbackBatch<T>(collectionName, batchIndex, maxItems);
      }

      const data = docSnap.data();
      if (collectionName === 'oirQuestions') {
        return mapDocToOIRBatch(docSnap.id, data, batchIndex) as unknown as BatchDocument<T>;
      }

      const rawItems: T[] = data.items || [];
      const cappedItems = rawItems.slice(0, maxItems);
      return {
        id: docSnap.id,
        batchIndex: data.batchIndex ?? batchIndex,
        totalItems: cappedItems.length,
        items: cappedItems
      };
    } catch (error) {
      console.warn(`Failed to fetch batch ${batchIndex} for ${collectionName}, using fallback`, error);
      return this.getFallbackBatch<T>(collectionName, batchIndex, maxItems);
    }
  }

  async getAvailableBatches(moduleName: string): Promise<TestBatchInfo[]> {
    const normModule = moduleName.toLowerCase().trim();
    const subcollMap: Record<string, string> = {
      oir: 'question_batches',
      ppdt: 'image_batches',
      tat: 'image_batches',
      wat: 'word_batches',
      srt: 'situation_batches'
    };
    const subcoll = subcollMap[normModule] || 'batches';

    try {
      const snap = await getDocs(collection(db, 'test_content', normModule, subcoll));
      if (!snap.empty) {
        const batches: TestBatchInfo[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const count = d.totalItems || d.totalWords || d.totalSituations || (d.words?.length) || (d.situations?.length) || (d.imageUrls?.length) || (d.items?.length);
          batches.push({
            id: docSnap.id,
            name: d.name || d.setName || d.title || `Batch ${batches.length + 1}`,
            itemCount: typeof count === 'number' ? count : undefined
          });
        });
        return batches;
      }
    } catch (err) {
      console.warn(`Failed to query SSOT batches for module ${normModule}`, err);
    }

    if (normModule === 'oir') {
      return [
        { id: 'batch_0', name: 'OIR Batch 1 (50 Qs)', itemCount: 50 },
        { id: 'batch_1', name: 'OIR Batch 2 (50 Qs)', itemCount: 50 },
        { id: 'batch_2', name: 'OIR Batch 3 (50 Qs)', itemCount: 50 }
      ];
    }
    if (normModule === 'ppdt') {
      return [
        { id: 'ppdt_1', name: 'PPDT Image 1 (Standard)', itemCount: 1 },
        { id: 'ppdt_2', name: 'PPDT Image 2 (Group Task)', itemCount: 1 }
      ];
    }
    if (normModule === 'tat') {
      return [
        { id: 'tat_set_1', name: 'TAT Set 1 (12 Slides)', itemCount: 12 },
        { id: 'tat_set_2', name: 'TAT Set 2 (12 Slides)', itemCount: 12 }
      ];
    }
    if (normModule === 'wat') {
      return [
        { id: 'wat_batch_1', name: 'WAT Batch 1 (60 Words)', itemCount: 60 },
        { id: 'wat_batch_2', name: 'WAT Batch 2 (60 Words)', itemCount: 60 }
      ];
    }
    if (normModule === 'srt') {
      return [
        { id: 'srt_batch_1', name: 'SRT Batch 1 (60 Situations)', itemCount: 60 },
        { id: 'srt_batch_2', name: 'SRT Batch 2 (60 Situations)', itemCount: 60 }
      ];
    }

    return [
      { id: `${normModule}_batch_1`, name: `${normModule.toUpperCase()} Batch 1` },
      { id: `${normModule}_batch_2`, name: `${normModule.toUpperCase()} Batch 2` }
    ];
  }

  private getFallbackBatch<T>(collectionName: string, batchIndex: number, maxItems: number): BatchDocument<T> {
    const fallbackItems: OIRQuestion[] = [];
    if (collectionName === 'oirQuestions') {
      for (let i = 1; i <= Math.min(50, maxItems); i++) {
        fallbackItems.push({
          id: `oir_${batchIndex}_${i}`,
          questionNumber: i,
          questionText: `Sample OIR Question #${i}: Find the odd one out.`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          type: i % 2 === 0 ? 'VERBAL' : 'NON_VERBAL'
        });
      }
    }
    return {
      id: `batch_${batchIndex}`,
      batchIndex,
      totalItems: fallbackItems.length,
      items: fallbackItems as unknown as T[]
    };
  }
}
