import { collection, doc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { IContentRepository } from './interfaces/IContentRepository';
import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument } from '../types/testContent';
import { getFallbackStudyMaterials, getFallbackStudyMaterialById } from '../constants/fallbackStudyMaterials';

export class ContentRepository implements IContentRepository {
  private static readonly MAX_BATCH_ITEMS = 50;

  async getStudyMaterials(): Promise<StudyMaterial[]> {
    try {
      // 1. Primary SSOT collection 'study_materials' (used by Android, iOS & Firestore setup scripts)
      let querySnapshot = await getDocs(query(collection(db, 'study_materials'), limit(50)));

      // 2. Fallback to 'studyMaterials' if 'study_materials' is empty
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(query(collection(db, 'studyMaterials'), limit(50)));
      }

      const materials: StudyMaterial[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        materials.push(this.mapDocToStudyMaterial(docSnap.id, data));
      });

      if (materials.length === 0) {
        return getFallbackStudyMaterials();
      }

      return materials;
    } catch (error) {
      console.warn('Failed to fetch study materials from Firestore, using offline fallback', error);
      return getFallbackStudyMaterials();
    }
  }

  async getStudyMaterialById(id: string): Promise<StudyMaterial | null> {
    try {
      // Primary SSOT collection 'study_materials'
      let docRef = doc(db, 'study_materials', id);
      let docSnap = await getDoc(docRef);

      // Fallback to 'studyMaterials' collection
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
    return this.getCappedBatch<OIRQuestion>('oirQuestions', batchIndex);
  }

  async getPPDTContext(id = 'ppdt_1'): Promise<PPDTContext> {
    try {
      const docRef = doc(db, 'ppdtContexts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title || 'PPDT Image Test',
          imageUrl: data.imageUrl || 'https://via.placeholder.com/600x400',
          viewingTimeSeconds: data.viewingTimeSeconds || 30,
          writingTimeSeconds: data.writingTimeSeconds || 240,
          instructions: data.instructions || ['Observe the image for 30s', 'Write a story in 4 minutes']
        };
      }
    } catch (error) {
      console.warn('Using offline fallback for PPDT context', error);
    }
    return {
      id,
      title: 'PPDT Practice Image',
      imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80',
      viewingTimeSeconds: 30,
      writingTimeSeconds: 240,
      instructions: ['Observe the picture for 30 seconds.', 'Identify characters and write a constructive story in 4 minutes.']
    };
  }

  async getTATSet(id = 'tat_set_1'): Promise<TATSet> {
    try {
      const docRef = doc(db, 'tatSets', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          setName: data.setName || 'TAT Practice Set 1',
          imageUrls: data.imageUrls || [],
          slideDurationSeconds: data.slideDurationSeconds || 240,
          totalSlides: data.totalSlides || (data.imageUrls ? data.imageUrls.length : 12)
        };
      }
    } catch (error) {
      console.warn('Using offline fallback for TAT set', error);
    }
    return {
      id,
      setName: 'TAT Practice Set 1',
      imageUrls: [
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80'
      ],
      slideDurationSeconds: 240,
      totalSlides: 2
    };
  }

  async getWATBatch(id = 'wat_batch_1'): Promise<WATBatch> {
    try {
      const docRef = doc(db, 'watBatches', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          words: data.words || [],
          displayDurationSeconds: data.displayDurationSeconds || 15
        };
      }
    } catch (error) {
      console.warn('Using offline fallback for WAT batch', error);
    }
    return {
      id,
      words: ['LEADERSHIP', 'COURAGE', 'HONESTY', 'CHALLENGE', 'TEAMWORK', 'SUCCESS'],
      displayDurationSeconds: 15
    };
  }

  async getSRTBatch(id = 'srt_batch_1'): Promise<SRTBatch> {
    try {
      const docRef = doc(db, 'srtBatches', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          situations: data.situations || [],
          totalTimeMinutes: data.totalTimeMinutes || 30
        };
      }
    } catch (error) {
      console.warn('Using offline fallback for SRT batch', error);
    }
    return {
      id,
      situations: [
        'He was going to appear for an exam and saw a road accident victim. He...',
        'While leading a trekking expedition, one of his teammates injured his leg severely. He...',
        'He was tasked to organize a college cultural fest with limited funds. He...'
      ],
      totalTimeMinutes: 30
    };
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
