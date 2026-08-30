import { collection, doc, getDoc, getDocs, query, limit, orderBy, where, FirestoreError, type DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';
import { IContentRepository } from './interfaces/IContentRepository';
import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo, GPEImage, OIRContentMeta } from '../types/testContent';
import { ContentUnavailableError } from '../types/errors';
import type { DocumentModel, DocSection } from '../components/content/blocks/types';
import { summarizeMarkdown } from '../utils/summarizeMarkdown';
import { getFallbackStudyMaterials, getFallbackStudyMaterialById } from '../constants/fallbackStudyMaterials';
import { primaryTestTypeIdForTopicType } from '../constants/topicTypeMapping';
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
      const querySnapshot = await getDocs(
        query(collection(db, FirestorePaths.STUDY_MATERIALS), orderBy('displayOrder'), limit(500))
      );
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

  // KMP (GitLiveStudyContentRepository.getStudyMaterial) looks a material up by its `id`
  // field, not by Firestore doc path -- aligned here (Phase 7, MEDIUM 4c) so both clients
  // resolve the same document even if a doc's path ever diverges from its `id` field.
  async getStudyMaterialById(id: string): Promise<StudyMaterial | null> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, FirestorePaths.STUDY_MATERIALS), where('id', '==', id), limit(1))
      );
      const docSnap = querySnapshot.docs[0];
      if (!docSnap) {
        return getFallbackStudyMaterialById(id);
      }
      return this.mapDocToStudyMaterial(docSnap.id, docSnap.data());
    } catch (error) {
      console.warn(`Failed to fetch study material ${id}, checking offline fallback`, error);
      return getFallbackStudyMaterialById(id);
    }
  }

  private mapDocToStudyMaterial(id: string, data: DocumentData): StudyMaterial {
    const topicType = typeof data.topicType === 'string' ? data.topicType : undefined;
    const content = data.contentMarkdown || data.introduction || data.content || '';
    const readTime = typeof data.readTime === 'number'
      ? data.readTime
      : typeof data.estimatedReadTimeMinutes === 'number'
      ? data.estimatedReadTimeMinutes
      : parseInt(String(data.readTime || '5'), 10) || 5;

    return {
      id,
      title: data.title || '',
      category: data.category || topicType || 'General',
      summary: data.summary || (content ? summarizeMarkdown(content) : ''),
      contentMarkdown: content,
      estimatedReadTimeMinutes: readTime,
      tags: data.tags || [],
      createdAt: typeof data.lastUpdated === 'number' ? new Date(data.lastUpdated).toISOString() : data.createdAt || new Date().toISOString(),
      dayNumber: data.dayNumber ? (String(data.dayNumber) as StudyMaterial['dayNumber']) : undefined,
      topicType,
      // Explicit testTypeId field wins if the document ever carries one directly;
      // otherwise derive it from topicType via the explicit table (see
      // constants/topicTypeMapping.ts) -- undefined, not guessed, when topicType maps to
      // more than one testTypeId (GTO, PSYCHOLOGY) or none (MEDICALS, SSB_OVERVIEW).
      testTypeId: (typeof data.testTypeId === 'string' ? data.testTypeId : undefined) as StudyMaterial['testTypeId']
        ?? primaryTestTypeIdForTopicType(topicType)
    };
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
    } catch (error) {
      const firestoreError = error instanceof FirestoreError ? error : undefined;
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || firestoreError?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for OIR batch ${batchId}:`, firestoreError?.message || error);
        return getFallbackOIRBatch(batchIndex);
      }
      throw error;
    }
  }

  async getPPDTContext(id = 'batch_001'): Promise<PPDTContext> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.TestContent.PPDT_BATCHES, id));
      if (!snap.exists()) {
        throw new ContentUnavailableError(`PPDT context ${id} is unavailable`);
      }
      return mapDocToPPDTContext(id, snap.data());
    } catch (error) {
      const firestoreError = error instanceof FirestoreError ? error : undefined;
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || firestoreError?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for PPDT context ${id}:`, firestoreError?.message || error);
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
    } catch (error) {
      const firestoreError = error instanceof FirestoreError ? error : undefined;
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || firestoreError?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for TAT set ${id}:`, firestoreError?.message || error);
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
    } catch (error) {
      const firestoreError = error instanceof FirestoreError ? error : undefined;
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || firestoreError?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for WAT batch ${id}:`, firestoreError?.message || error);
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
    } catch (error) {
      const firestoreError = error instanceof FirestoreError ? error : undefined;
      if (error instanceof ContentUnavailableError) throw error;
      if (import.meta.env.DEV || firestoreError?.code === 'permission-denied') {
        console.warn(`[DEV MODE] Using offline fallback for SRT batch ${id}:`, firestoreError?.message || error);
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

  /**
   * D2 side document `study_material_sections/{id}` (Phase 5, docs/plans/
   * write-the-phased-plan-wobbly-pancake.md) -- fetched only when a material's reader is
   * actually opened (StudyReaderModal), never as part of the study-materials list query, same
   * "fetched only on detail open" contract as KMP's `GitLiveStudyContentRepository.
   * getStudyMaterialSections`. `table` blocks' rows come back wrapped as `{ cells }`
   * (`publishContent.js`'s `sanitizeForFirestore` -- Firestore rejects a directly-nested
   * array), unwrapped back to `string[][]` here to match every other DocumentModel consumer
   * (the build-time bundle, KMP).
   */
  async getStudyMaterialSections(id: string): Promise<DocumentModel | null> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.STUDY_MATERIAL_SECTIONS, id));
      if (!snap.exists()) return null;
      const data = snap.data() as { sections?: DocSection[] };
      if (!Array.isArray(data.sections)) return null;
      return {
        sections: data.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) =>
            block.type === 'table'
              ? { ...block, rows: (block as unknown as { rows: { cells: string[] }[] }).rows.map((r) => r.cells) }
              : block
          ),
        })),
      };
    } catch (error) {
      console.warn(`Failed to fetch study material sections for ${id}`, error);
      return null;
    }
  }
}
